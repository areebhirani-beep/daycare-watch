Pod::Spec.new do |s|
  s.name           = 'LookAround'
  s.version        = '1.0.0'
  s.summary        = 'Apple Look Around snapshots and viewer for a daycare\'s street front'
  s.author         = ''
  s.homepage       = 'https://github.com/areebhirani-beep/daycare-watch'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
