using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TodoAppBackend.Data;
using TodoAppBackend.Models;
using Microsoft.AspNetCore.Identity;

namespace TodoAppBackend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TodosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<TodosController> _logger;
        private readonly UserManager<ApplicationUser> _userManager;

        public TodosController(ApplicationDbContext context, ILogger<TodosController> logger, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _logger = logger;
            _userManager = userManager;
        }

        private string GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        }
        
        // Sadece Inbox ekranına erişim izni olan misafir kullanıcılar için
        [HttpGet("inbox")]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<Todo>>> GetInboxTodos()
        {
            try
            {
                var userId = GetCurrentUserId();
                var todos = await _context.Todos
                    .Where(t => t.UserId == userId && t.DueDate == null)
                    .OrderByDescending(t => t.CreatedAt)
                    .ToListAsync();

                return Ok(todos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting inbox todos");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }
        
        // Sadece kayıtlı kullanıcıların erişimi için
        [HttpGet("today")]
        public async Task<ActionResult<IEnumerable<Todo>>> GetTodayTodos()
        {
            try
            {
                var userId = GetCurrentUserId();
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null && user.IsGuest)
                {
                    return StatusCode(403, new { message = "Misafir kullanıcılar bu sayfaya erişemez. Lütfen giriş yapın veya kaydolun." });
                }

                var today = DateTime.UtcNow.Date;
                var todos = await _context.Todos
                    .Where(t => t.UserId == userId && t.DueDate.HasValue && t.DueDate.Value.Date <= today)
                    .OrderByDescending(t => t.CreatedAt)
                    .ToListAsync();
                return Ok(todos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting today todos");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }
        
        // Sadece kayıtlı kullanıcıların erişimi için
        [HttpGet("upcoming")]
        public async Task<ActionResult<IEnumerable<Todo>>> GetUpcomingTodos()
        {
            try
            {
                var userId = GetCurrentUserId();
                var user = await _userManager.FindByIdAsync(userId);
                if (user != null && user.IsGuest)
                {
                    return StatusCode(403, new { message = "Misafir kullanıcılar bu sayfaya erişemez. Lütfen giriş yapın veya kaydolun." });
                }

                var today = DateTime.UtcNow.Date;
                var todos = await _context.Todos
                    .Where(t => t.UserId == userId && t.DueDate.HasValue && t.DueDate.Value.Date > today)
                    .OrderBy(t => t.DueDate)
                    .ToListAsync();
                return Ok(todos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting upcoming todos");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // Tüm görevleri getiren genel uç nokta
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Todo>>> GetTodos()
        {
            try
            {
                var userId = GetCurrentUserId();
                var todos = await _context.Todos
                    .Where(t => t.UserId == userId)
                    .OrderByDescending(t => t.CreatedAt)
                    .ToListAsync();

                return Ok(todos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting todos");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // Belirli bir görevi getiren uç nokta
        [HttpGet("{id}")]
        public async Task<ActionResult<Todo>> GetTodo(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var todo = await _context.Todos
                    .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

                if (todo == null)
                {
                    return NotFound(new { message = "Todo not found" });
                }

                return Ok(todo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting todo");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // Yeni görev oluşturan uç nokta
        [HttpPost]
        public async Task<ActionResult<Todo>> PostTodo(TodoCreateDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();

                // Misafir kullanıcısı için görev sınırını kontrol et
                var isGuest = User.HasClaim(c => c.Type == "IsGuest" && c.Value == "true");

                if (isGuest)
                {
                    var todayTodosCount = await _context.Todos
                        .CountAsync(t => t.UserId == userId && t.CreatedAt.Date == DateTime.UtcNow.Date);
                    
                    if (todayTodosCount >= 10)
                    {
                        return BadRequest(new { message = "Misafir kullanıcılar günde en fazla 10 görev oluşturabilir." });
                    }
                }

                var todo = new Todo
                {
                    Title = dto.Title,
                    IsCompleted = dto.IsCompleted,
                    DueDate = dto.DueDate,
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Todos.Add(todo);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Todo created: {todo.Id} for user {userId}");

                // Sorunlu CreatedAtAction yerine basit bir Ok döndürüyoruz.
                // Not: CreatedAtAction, yeni oluşturulan kaynağın URI'sini döndürmek için daha doğrudur,
                // ancak döngüsel referans sorununu çözmek için bu yaklaşımı kullanıyoruz.
                return Ok(todo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating todo");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // Görev güncelleyen uç nokta
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTodo(int id, TodoUpdateDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var todo = await _context.Todos
                    .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

                if (todo == null)
                {
                    return NotFound(new { message = "Todo not found" });
                }

                // Misafir kullanıcılar görev detaylarını güncelleyemez.
                var isGuest = User.HasClaim(c => c.Type == "IsGuest" && c.Value == "true");
                if (isGuest)
                {
                    return StatusCode(403, new { message = "Misafir kullanıcılar görev detaylarını güncelleyemez." });
                }

                todo.Title = dto.Title;
                todo.IsCompleted = dto.IsCompleted;
                todo.DueDate = dto.DueDate;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Todo updated: {todo.Id}");

                return Ok(todo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating todo");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // Görev silen uç nokta
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTodo(int id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var todo = await _context.Todos
                    .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

                if (todo == null)
                {
                    return NotFound(new { message = "Todo not found" });
                }

                _context.Todos.Remove(todo);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Todo deleted: {id}");

                return Ok(new { message = "Todo deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting todo");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }
    }
}
