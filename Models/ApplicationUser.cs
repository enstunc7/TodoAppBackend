using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace TodoAppBackend.Models
{
    public class ApplicationUser : IdentityUser
    {
        public bool IsGuest { get; set; } = false;

        public int DailyGoal { get; set; } = 0;

        [JsonIgnore]
        public ICollection<Todo> Todos { get; set; } = new List<Todo>();

        public ICollection<Tag> Tags { get; set; } = new List<Tag>();
    }
}