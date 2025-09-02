using System.ComponentModel.DataAnnotations;

namespace TodoAppBackend.Models
{
    public record RegisterDto(
        [Required] string Username,
        [Required] [MinLength(6)] string Password
    );

    public record LoginDto(
        [Required] string Username,
        [Required] string Password
    );

    public record TodoCreateDto(
        [Required] [MaxLength(200)] string Title,
        bool IsCompleted = false,
        DateTime? DueDate = null
    );

    public record TodoUpdateDto(
        [Required] [MaxLength(200)] string Title,
        bool IsCompleted,
        DateTime? DueDate = null
    );
}