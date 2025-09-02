using System.ComponentModel.DataAnnotations;

namespace TodoAppBackend.Models
{
    public class Todo
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;
        
        public bool IsCompleted { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? DueDate { get; set; }
        
        public string UserId { get; set; } = string.Empty;
        
        public virtual ApplicationUser? User { get; set; }
    }
}