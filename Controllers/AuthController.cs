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

        private string TranslateError(string code, string defaultDescription)
        {
            return code switch
            {
                "InvalidUserName" => "Kullanıcı adı geçersiz karakterler içeriyor.",
                "DuplicateUserName" => "Bu kullanıcı adı zaten kullanılıyor.",
                "PasswordTooShort" => "Şifre en az 6 karakter uzunluğunda olmalıdır.",
                "PasswordRequiresNonAlphanumeric" => "Şifre en az bir özel karakter içermelidir.",
                "PasswordRequiresDigit" => "Şifre en az bir rakam içermelidir.",
                "PasswordRequiresUpper" => "Şifre en az bir büyük harf içermelidir.",
                "PasswordRequiresLower" => "Şifre en az bir küçük harf içermelidir.",
                _ => defaultDescription
            };
        }

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
                    return BadRequest(new { message = "Bu kullanıcı adı zaten kullanılıyor" });
                }

                var user = new ApplicationUser 
                { 
                    UserName = dto.Username,
                    Email = $"{dto.Username}@todoapp.com"
                };

                var result = await _userManager.CreateAsync(user, dto.Password);

                if (!result.Succeeded)
                {
                    var errors = result.Errors.Select(e => new 
                    {
                        Code = e.Code,
                        Description = TranslateError(e.Code, e.Description)
                    }).ToList();

                    _logger.LogWarning("Registration failed for user {Username}. Errors: {@Errors}", 
                        dto.Username, errors);

                    return BadRequest(new 
                    { 
                        message = "Kayıt işlemi başarısız oldu", 
                        errors = errors
                    });
                }

                _logger.LogInformation($"User {dto.Username} registered successfully");
                return Ok(new { message = "Kullanıcı başarıyla kaydedildi" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during registration");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        [HttpPost("login")]
        [ProducesResponseType(typeof(AuthResponseDto), 200)]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(dto.Username);
                if (user == null)
                {
                    return Unauthorized(new { message = "Invalid username or password" });
                }

                // 🌟 Guest kullanıcı için şifre kontrolü yapılmaz
                if (!user.IsGuest)
                {
                    // Normal kullanıcı: şifre kontrolü gerekir
                    if (string.IsNullOrWhiteSpace(dto.Password) ||
                        !await _userManager.CheckPasswordAsync(user, dto.Password))
                    {
                        return Unauthorized(new { message = "Invalid username or password" });
                    }
                }

                var token = GenerateJwtToken(user);

                _logger.LogInformation($"User {dto.Username} logged in successfully");

                return Ok(new AuthResponseDto
                {
                    Token = token,
                    UserId = user.Id,
                    Username = user.UserName,
                    IsGuest = user.IsGuest
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }



        [HttpPost("guest-login")]
        public async Task<ActionResult<AuthResponseDto>> GuestLogin()
        {
            var guestId = $"guest_{Guid.NewGuid()}";
            var guestUsername = $"Guest_{Guid.NewGuid().ToString().Substring(0, 8)}";

            var guestUser = new ApplicationUser
            {
                Id = guestId,
                UserName = guestUsername,
                Email = $"{guestUsername}@todoapp.com",
                IsGuest = true
            };

            // Önce kullanıcıyı yarat
            var result = await _userManager.CreateAsync(guestUser, "Guest123!");

            if (result.Succeeded)
            {
                // 👇 Önemli: DB'ye kesin yaz!
                guestUser.IsGuest = true;
                await _userManager.UpdateAsync(guestUser);

                var token = GenerateJwtToken(guestUser);
                return Ok(new AuthResponseDto
                {
                    Token = token,
                    UserId = guestUser.Id,
                    Username = guestUser.UserName,
                    IsGuest = true
                });
            }

            return BadRequest(new
            {
                message = "Guest creation failed",
                errors = result.Errors.Select(e => e.Description)
            });
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
