using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TodoAppBackend.Models
{
    public class Tag
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = null!;

        public string UserId { get; set; } = null!;

        // Döngüyü kır: Tag -> User -> Tags -> ...
        [JsonIgnore]
        public ApplicationUser User { get; set; } = null!;

        // Döngüyü kır: Tag -> Todos -> Tags -> ...
        [JsonIgnore]
        public ICollection<Todo> Todos { get; set; } = new List<Todo>();
    }
}
