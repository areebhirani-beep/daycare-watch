import ExpoModulesCore
import MapKit
import UIKit

struct SnapshotOptions: Record {
  @Field var name: String?
  @Field var width: Double = 1024
  @Field var height: Double = 768
  /// Stable per daycare (its operation id), so a snapshot is made once and read from disk after.
  @Field var cacheKey: String?
}

/// How the scene was found. "place": Apple Maps matched the daycare by name within 60 m of its point, so the camera
/// is framed on that place. "point": the street nearest the address point, which may face another building.
private enum Facing: String {
  case place
  case point
}

public class LookAroundModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LookAround")

    // A still street-level image of the daycare's front, or nil where Apple has no Look Around imagery.
    AsyncFunction("snapshot") { (lat: Double, lng: Double, options: SnapshotOptions) async throws -> [String: Any]? in
      if let key = options.cacheKey, let cached = Self.cached(key) {
        return ["uri": cached.url.absoluteString, "facing": cached.facing.rawValue]
      }
      guard let (scene, facing, meters) = try await Self.findScene(lat: lat, lng: lng, name: options.name) else {
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

    // The full, interactive Look Around (walk the street, look around), over the app. False if there is none.
    AsyncFunction("present") { (lat: Double, lng: Double, name: String?) async throws -> Bool in
      guard let (scene, _, _) = try await Self.findScene(lat: lat, lng: lng, name: name) else { return false }
      return await MainActor.run { [weak self] in
        guard let top = self?.appContext?.utilities?.currentViewController() else { return false }
        let viewer = MKLookAroundViewController(scene: scene)
        viewer.modalPresentationStyle = .fullScreen
        top.present(viewer, animated: true)
        return true
      }
    }
  }

  /// Apple's place for the daycare when its name matches a point of interest within 60 m, so the camera faces that
  /// building; otherwise the street at the address point. Also returns how far Apple's place is from our point.
  private static func findScene(lat: Double, lng: Double, name: String?) async throws -> (MKLookAroundScene, Facing, Double?)? {
    let point = CLLocationCoordinate2D(latitude: lat, longitude: lng)
    if let name, !name.isEmpty {
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = name
      request.region = MKCoordinateRegion(center: point, latitudinalMeters: 600, longitudinalMeters: 600)
      request.resultTypes = .pointOfInterest
      let here = CLLocation(latitude: lat, longitude: lng)
      if let response = try? await MKLocalSearch(request: request).start(),
         let item = response.mapItems.first(where: { ($0.placemark.location?.distance(from: here) ?? .infinity) <= 60 }),
         let scene = try? await MKLookAroundSceneRequest(mapItem: item).scene {
        return (scene, .place, item.placemark.location?.distance(from: here))
      }
    }
    guard let scene = try await MKLookAroundSceneRequest(coordinate: point).scene else { return nil }
    return (scene, .point, nil)
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
    // v2: matched within 60 m (v1 allowed 150 m), so older snapshots are never reused.
    folder.appendingPathComponent("v2-\(key)-\(facing.rawValue).jpg")
  }

  // A week: Apple refreshes Look Around rarely, and the cache lives in Caches, which iOS may clear anyway.
  private static func cached(_ key: String) -> (url: URL, facing: Facing)? {
    for facing in [Facing.place, Facing.point] {
      let url = file(key, facing)
      if let made = (try? FileManager.default.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date,
         Date().timeIntervalSince(made) < 7 * 24 * 3600 {
        return (url, facing)
      }
    }
    return nil
  }
}
