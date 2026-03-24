// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MyApp",
    platforms: [.iOS(.v17)],
    dependencies: [],
    targets: [
        .executableTarget(name: "MyApp", path: "Sources/MyApp"),
    ]
)
