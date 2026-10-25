import ExpoModulesCore
import MapKit
import UIKit

struct SnapshotOptions: Record {
  @Field var name: String?
  @Field var width: Double = 1024
  @Field var height: Double = 768
  /// Stable per daycare (its operation id), so a snapshot is made once and read from disk after.
  @Field var cacheKey: String?
  /// With no same-name place, fall back to the street at the address point (labelled as such by the app).
  @Field var allowPoint: Bool = false
}

/// How the scene was found. "place": Apple Maps matched the daycare by name within 60 m of its point, so the camera
/// is framed on that place. "point": no such place, so the scene nearest the state's address point, looking at it;
/// it may show a neighbouring building, and the app says so.
private enum Facing: String {
  case place
  case point
}

public class LookAroundModule: Module {
  /// The viewer on screen, if any, so the app can close it when it moves on (a tapped alert, say).
  private weak var shown: MKLookAroundViewController?

  public func definition() -> ModuleDefinition {
    Name("LookAround")

    // A still street-level image: the daycare's front where Apple matched it by name, else (allowPoint) the street at
    // its address point; nil where Apple has neither.
    AsyncFunction("snapshot") { (lat: Double, lng: Double, options: SnapshotOptions) async throws -> [String: Any]? in
      if let key = options.cacheKey, let cached = Self.cached(key, allowPoint: options.allowPoint) {
        return ["uri": cached.url.absoluteString, "facing": cached.facing.rawValue]
      }
      guard let (scene, facing, meters) = try await Self.findScene(lat: lat, lng: lng, name: options.name, allowPoint: options.allowPoint) else {
        return nil
      }
      let image = try await Self.render(scene, size: CGSize(width: options.width, height: options.height))
      guard let data = image.jpegData(compressionQuality: 0.85) else { return nil }
      let url = Self.file(options.cacheKey ?? UUID().uuidString, facing)
      try data.write(to: url, options: .atomic)
      var result: [String: Any] = ["uri": url.absoluteString, "facing": facing.rawValue]
      if let meters { result["distanceM"] = meters }
      return result
    }

    // Draws the 3D flyover the app is about to show (same camera as FlyoverHero) off screen and resolves once Apple
    // has rendered it. The map view shares the tiles, so it fades in only when its picture is complete.
    AsyncFunction("prepareFlyover") { (lat: Double, lng: Double, width: Double, height: Double) async throws -> Bool in
      let camera = MKMapCamera()
      camera.centerCoordinate = CLLocationCoordinate2D(latitude: lat, longitude: lng)
      camera.altitude = 340
      camera.pitch = 56
      camera.heading = 20
      let options = MKMapSnapshotter.Options()
      options.camera = camera
      options.mapType = .satelliteFlyover
      options.size = CGSize(width: max(width, 1), height: max(height, 1))
      options.pointOfInterestFilter = .excludingAll
      _ = try await MKMapSnapshotter(options: options).start()
      return true
    }

    // The full, interactive Look Around (walk the street, look around), over the app. False if there is none.
    AsyncFunction("present") { (lat: Double, lng: Double, name: String?, allowPoint: Bool) async throws -> Bool in
      guard let (scene, _, _) = try await Self.findScene(lat: lat, lng: lng, name: name, allowPoint: allowPoint) else { return false }
      return await MainActor.run { [weak self] in
        guard let top = self?.appContext?.utilities?.currentViewController() else { return false }
        let viewer = MKLookAroundViewController(scene: scene)
        viewer.modalPresentationStyle = .fullScreen
        top.present(viewer, animated: true)
        self?.shown = viewer
        return true
      }
    }

    // Closes the viewer, if one is open, without animation.
    AsyncFunction("dismiss") { () async -> Void in
      await MainActor.run { [weak self] in
        if let viewer = self?.shown, viewer.presentingViewController != nil { viewer.dismiss(animated: false) }
        self?.shown = nil
      }
    }
  }

  /// Apple's place for the daycare when its name matches a point of interest within 60 m, so the camera faces that
  /// building; otherwise, with allowPoint, the scene at the address point; otherwise nil. Also returns how far Apple's
  /// place is from our point. Only one is ever returned, so the carousel never shows the same spot twice.
  private static func findScene(lat: Double, lng: Double, name: String?, allowPoint: Bool) async throws -> (MKLookAroundScene, Facing, Double?)? {
    let point = CLLocationCoordinate2D(latitude: lat, longitude: lng)
    if let name, !name.isEmpty {
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = name
      request.region = MKCoordinateRegion(center: point, latitudinalMeters: 600, longitudinalMeters: 600)
      request.resultTypes = .pointOfInterest
      let here = CLLocation(latitude: lat, longitude: lng)
      if let response = try? await MKLocalSearch(request: request).start(),
         let item = response.mapItems.first(where: {
           ($0.placemark.location?.distance(from: here) ?? .infinity) <= 60 && sameName(name, $0.name ?? "")
         }),
         let scene = try? await MKLookAroundSceneRequest(mapItem: item).scene {
        return (scene, .place, item.placemark.location?.distance(from: here))
      }
    }
    guard allowPoint, let scene = try await MKLookAroundSceneRequest(coordinate: point).scene else { return nil }
    return (scene, .point, nil)
  }

  // Words every daycare name shares, so "Kids Academy" never matches "Little Stars Academy" next door.
  private static let generic: Set<String> = [
    "the", "of", "at", "and", "a", "academy", "learning", "center", "centre", "child", "children", "childrens", "care",
    "day", "daycare", "development", "early", "education", "kids", "kid", "school", "preschool", "montessori", "inc", "llc",
  ]

  private static func words(_ s: String) -> Set<String> {
    let folded = s.lowercased().replacingOccurrences(of: "'", with: "").replacingOccurrences(of: "\u{2019}", with: "")
    return Set(folded.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty && !generic.contains($0) })
  }

  /// Apple's place is the daycare only if every distinctive word of Apple's name is in the state's name
  /// ("Meridian Montessori" for "Meridian Montessori of Plano"); a search can return any business nearby.
  static func sameName(_ ours: String, _ apples: String) -> Bool {
    let theirs = words(apples)
    return !theirs.isEmpty && theirs.isSubset(of: words(ours))
  }

  @MainActor
  private static func render(_ scene: MKLookAroundScene, size: CGSize) async throws -> UIImage {
    let options = MKLookAroundSnapshotter.Options()
    options.size = size
    options.pointOfInterestFilter = .excludingAll
    return try await MKLookAroundSnapshotter(scene: scene, options: options).snapshot.image
  }

  private static var folder: URL {
    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("look-around")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private static func file(_ key: String, _ facing: Facing) -> URL {
    // v3: matched by name and within 60 m (v2 skipped the name check, v1 allowed 150 m); older snapshots are never reused.
    folder.appendingPathComponent("v3-\(key)-\(facing.rawValue).jpg")
  }

  // A week: Apple refreshes Look Around rarely, and the cache lives in Caches, which iOS may clear anyway.
  private static func cached(_ key: String, allowPoint: Bool) -> (url: URL, facing: Facing)? {
    for facing in allowPoint ? [Facing.place, Facing.point] : [Facing.place] {
      let url = file(key, facing)
      if let made = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date,
         Date().timeIntervalSince(made) < 7 * 24 * 3600 {
        return (url, facing)
      }
    }
    return nil
  }
}
