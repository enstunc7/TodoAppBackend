using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using TodoAppBackend.Models;

namespace TodoAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            UserManager<ApplicationUser> userManager, 
            IConfiguration configuration,
            ILogger<AuthController> logger)
        {
            _userManager = userManager;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            try
            {
                var existingUser = await _userManager.FindByNameAsync(dto.Username);
                if (existingUser != null)
                {
                    return BadRequest(new { message = "Username already exists" });
                }

                var user = new ApplicationUser 
                { 
                    UserName = dto.Username,
                    Email = $"{dto.Username}@todoapp.com"
                };

                var result = await _userManager.CreateAsync(user, dto.Password);

                if (!result.Succeeded)
                {
                    return BadRequest(new { 
                        message = "Registration failed", 
                        errors = result.Errors.Select(e => e.Description) 
                    });
                }

                _logger.LogInformation($"User {dto.Username} registered successfully");
                return Ok(new { message = "User registered successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during registration");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(dto.Username);
                if (user == null || !await _userManager.CheckPasswordAsync(user, dto.Password))
                {
                    return Unauthorized(new { message = "Invalid username or password" });
                }

                var token = GenerateJwtToken(user);
                
                _logger.LogInformation($"User {dto.Username} logged in successfully");
                
                return Ok(new { 
                    token = token,
                    userId = user.Id,
                    username = user.UserName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        [HttpPost("guest-login")]
        public IActionResult GuestLogin()
        {
            try
            {
                // Misafir kullanıcısı için benzersiz bir kimlik ve isim oluştur.
                var guestId = $"guest_{Guid.NewGuid()}";
                var guestUsername = $"Guest_{Guid.NewGuid().ToString().Substring(0, 8)}";

                // Misafir kullanıcı nesnesini bellekte oluştur, veritabanına kaydetme.
                var guestUser = new ApplicationUser
                {
                    Id = guestId,
                    UserName = guestUsername,
                    IsGuest = true
                };

                var token = GenerateJwtToken(guestUser);

                _logger.LogInformation($"Guest user {guestUser.UserName} logged in successfully");

                return Ok(new {
                    token = token,
                    userId = guestUser.Id,
                    username = guestUser.UserName
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during guest login");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        private string GenerateJwtToken(ApplicationUser user)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id),
                new(ClaimTypes.Name, user.UserName!),
                new(JwtRegisteredClaimNames.Sub, user.Id),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.Iat, new DateTimeOffset(DateTime.UtcNow).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            };
            
            // Misafir kullanıcılar için özel bir claim ekle.
            if (user.IsGuest)
            {
                claims.Add(new Claim("IsGuest", "true"));
            }

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(int.Parse(jwtSettings["ExpireDays"]!)),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
