namespace TodoAppBackend.Models
{
    public record TodoCalendarItemDto(
        int Id,
        string Title,
        bool IsCompleted,
        DateTime? DueDate,
        List<TagDto> Tags
    );
}
