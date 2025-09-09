using System.ComponentModel.DataAnnotations;

namespace TodoAppBackend.Models
{
    public record SetDailyGoalDto([Range(0, 1000)] int DailyGoal);

    public record DailyProgressDto(
        int CompletedToday,
        int DailyGoal,
        bool Achieved
    );
}
