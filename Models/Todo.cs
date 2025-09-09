using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

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

        public DateTime? CompletedAt { get; set; }

        public string UserId { get; set; } = string.Empty;

        // Döngüyü kır: Todo -> User -> Todos/Tags -> ...
        [JsonIgnore]
        public ApplicationUser? User { get; set; }

        // BUNU DÖNMEK İSTİYORUZ: Todo'ların üzerinde etiketler görünsün
        public ICollection<Tag> Tags { get; set; } = new List<Tag>();
    }
}
