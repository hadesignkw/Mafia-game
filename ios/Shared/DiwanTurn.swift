import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// دور اللي يسولف بالمافيا: يطلع بالجزيرة وعلى الشاشة المقفلة
@available(iOS 16.1, *)
struct DiwanTurn: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String
        var mine: Bool
        var start: Date
        var ends: Date
    }
}
#endif
