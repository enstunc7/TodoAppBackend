using System.ComponentModel.DataAnnotations;

namespace TodoAppBackend.Models
{
    public class Todo
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public required string Title { get; set; }
        
        public bool IsCompleted { get; set; } = false;
        
        public DateTime? DueDate { get; set; }
        
        [Required]
        public required string UserId { get; set; }
        
        public ApplicationUser? User { get; set; }
    }
}