namespace TodoAppBackend.Models
{
    public class AuthResponseDto
    {
        public string? Token { get; set; }
        public string? UserId { get; set; }
        public string? Username { get; set; }
        public bool IsGuest { get; set; }
    }
}