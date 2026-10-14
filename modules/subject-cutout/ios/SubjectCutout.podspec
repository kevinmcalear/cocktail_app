Pod::Spec.new do |s|
  s.name           = 'SubjectCutout'
  s.version        = '1.0.0'
  s.summary        = 'Lifts the subject out of a photo on the device (Vision).'
  s.description    = 'Writes a PNG with alpha of a photo subject, using the iOS 17 foreground instance mask.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # The pixel loop is slow unoptimised, and dev clients build Debug.
    'SWIFT_OPTIMIZATION_LEVEL' => '-O',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
