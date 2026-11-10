import WidgetKit
import SwiftUI
import ActivityKit

private let brass = Color(red: 0.79, green: 0.64, blue: 0.36)
private let ink = Color(red: 0.055, green: 0.043, blue: 0.035)

@main
struct DiwanLiveBundle: WidgetBundle {
    var body: some Widget { DiwanTurnLive() }
}

private func initial(_ s: String) -> String { s.first.map(String.init) ?? "؟" }

private struct Avatar: View {
    let name: String, size: CGFloat
    var body: some View {
        Text(initial(name))
            .font(.system(size: size * 0.5, weight: .bold))
            .foregroundColor(ink)
            .frame(width: size, height: size)
            .background(Circle().fill(brass))
    }
}

private struct Countdown: View {
    let st: DiwanTurn.ContentState
    var size: CGFloat = 17
    var body: some View {
        Text(timerInterval: st.start...max(st.start, st.ends), countsDown: true, showsHours: false)
            .font(.system(size: size, weight: .semibold).monospacedDigit())
            .foregroundColor(brass)
            .multilineTextAlignment(.trailing)
    }
}

struct DiwanTurnLive: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DiwanTurn.self) { ctx in
            // الشاشة المقفلة
            HStack(spacing: 12) {
                Avatar(name: ctx.state.name, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(ctx.state.mine ? "دورك تسولف!" : "يسولف الحين").font(.caption).foregroundColor(.white.opacity(0.7))
                    Text(ctx.state.name).font(.headline).foregroundColor(.white).lineLimit(1)
                }
                Spacer()
                Countdown(st: ctx.state, size: 28).frame(maxWidth: 90)
            }
            .padding(16)
            .activityBackgroundTint(ink.opacity(0.92))
            .activitySystemActionForegroundColor(brass)
            .environment(\.layoutDirection, .rightToLeft)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Avatar(name: ctx.state.name, size: 40).padding(.leading, 4) }
                DynamicIslandExpandedRegion(.trailing) { Countdown(st: ctx.state, size: 24).frame(maxWidth: 80).padding(.trailing, 4) }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(ctx.state.name).font(.headline).lineLimit(1)
                        Text(ctx.state.mine ? "دورك تسولف!" : "يسولف الحين").font(.caption).foregroundColor(.white.opacity(0.7))
                    }
                }
            } compactLeading: {
                Text(ctx.state.name).font(.system(size: 13, weight: .semibold)).lineLimit(1).frame(maxWidth: 64)
            } compactTrailing: {
                Countdown(st: ctx.state, size: 13).frame(width: 40)
            } minimal: {
                Avatar(name: ctx.state.name, size: 22)
            }
            .keylineTint(brass)
        }
    }
}
