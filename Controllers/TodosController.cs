using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using TodoAppBackend.Data;
using TodoAppBackend.Models;

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

        private async Task<(string userId, bool isGuest)> GetUserInfoAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var user = await _userManager.FindByIdAsync(userId);
            return (userId, user != null && user.IsGuest);
        }

        // GET: /api/todos/inbox
        [HttpGet("inbox")]
        public async Task<ActionResult<IEnumerable<Todo>>> GetInboxTodos()
        {
            var (userId, _) = await GetUserInfoAsync();

            var todos = await _context.Todos
                .Where(t => t.UserId == userId && t.DueDate == null)
                .Include(t => t.Tags)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(todos);
        }

        // GET: /api/todos/today
        [HttpGet("today")]
        public async Task<ActionResult<IEnumerable<Todo>>> GetTodayTodos()
        {
            var (userId, isGuest) = await GetUserInfoAsync();

            if (isGuest)
                return StatusCode(403, new { message = "Misafir kullanıcılar bu sayfaya erişemez." });

            var today = DateTime.UtcNow.Date;

            var todos = await _context.Todos
                .Where(t => t.UserId == userId && t.DueDate != null && t.DueDate.Value.Date <= today)
                .Include(t => t.Tags)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(todos);
        }

        // GET: /api/todos/upcoming
        [HttpGet("upcoming")]
        public async Task<ActionResult<IEnumerable<Todo>>> GetUpcomingTodos()
        {
            var (userId, isGuest) = await GetUserInfoAsync();

            if (isGuest)
                return StatusCode(403, new { message = "Misafir kullanıcılar bu sayfaya erişemez." });

            var today = DateTime.UtcNow.Date;

            var todos = await _context.Todos
                .Where(t => t.UserId == userId && t.DueDate != null && t.DueDate.Value.Date > today)
                .Include(t => t.Tags)
                .OrderBy(t => t.DueDate)
                .ToListAsync();

            return Ok(todos);
        }

        // GET: /api/todos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Todo>>> GetTodos()
        {
            var (userId, _) = await GetUserInfoAsync();

            var todos = await _context.Todos
                .Where(t => t.UserId == userId)
                .Include(t => t.Tags)
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(todos);
        }

        // GET: /api/todos/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<Todo>> GetTodo(int id)
        {
            var (userId, _) = await GetUserInfoAsync();

            var todo = await _context.Todos
                .Include(t => t.Tags)
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

            if (todo == null)
                return NotFound(new { message = "Görev bulunamadı." });

            return Ok(todo);
        }

        // POST: /api/todos
        [HttpPost]
        public async Task<ActionResult<Todo>> PostTodo([FromBody] TodoCreateDto dto)
        {
            var (userId, isGuest) = await GetUserInfoAsync();

            if (isGuest)
            {
                if (dto.DueDate != null)
                    return BadRequest(new { message = "Misafir kullanıcılar yalnızca due date içermeyen (Inbox) görevler oluşturabilir." });

                var todayCount = await _context.Todos.CountAsync(t =>
                    t.UserId == userId && t.CreatedAt.Date == DateTime.UtcNow.Date);

                if (todayCount >= 10)
                    return BadRequest(new { message = "Misafir kullanıcılar günde en fazla 10 görev oluşturabilir." });
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

            return Ok(todo);
        }

        // PUT: /api/todos/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTodo(int id, [FromBody] TodoUpdateDto dto)
        {
            var (userId, isGuest) = await GetUserInfoAsync();

            if (isGuest)
                return StatusCode(403, new { message = "Misafir kullanıcılar görev güncelleyemez." });

            var todo = await _context.Todos.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

            if (todo == null)
                return NotFound(new { message = "Görev bulunamadı." });
            var wasCompleted = todo.IsCompleted;
            todo.Title = dto.Title;
            todo.IsCompleted = dto.IsCompleted;
            todo.DueDate = dto.DueDate;

            if (!wasCompleted && dto.IsCompleted)
            {
                // yeni tamamlandı
                todo.CompletedAt = DateTime.UtcNow;
            }
            else if (wasCompleted && !dto.IsCompleted)
            {
                // geri alındı
                todo.CompletedAt = null;
            }

            await _context.SaveChangesAsync();

            return Ok(todo);
        }

        // DELETE: /api/todos/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTodo(int id)
        {
            var (userId, isGuest) = await GetUserInfoAsync();

            if (isGuest)
                return StatusCode(403, new { message = "Misafir kullanıcılar görev silemez." });

            // ✅ Todo'yu tag'leriyle birlikte çek
            var todo = await _context.Todos
                .Include(t => t.Tags)
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

            if (todo == null)
                return NotFound(new { message = "Görev bulunamadı." });

            // ✅ Önce ilişkili TodoTags kayıtlarını temizle
            todo.Tags.Clear();
            await _context.SaveChangesAsync();

            // ✅ Sonra Todo'yu sil
            _context.Todos.Remove(todo);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Görev silindi." });
        }


        // PUT: /api/todos/{id}/tags
        [HttpPut("{id}/tags")]
        public async Task<IActionResult> UpdateTodoTags(int id, TodoTagUpdateDto dto)
        {
            try
            {
                var (userId, isGuest) = await GetUserInfoAsync();

                if (isGuest)
                    return StatusCode(403, new { message = "Misafir kullanıcılar bu işlemi yapamaz." });

                var todo = await _context.Todos
                    .Include(t => t.Tags)
                    .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);

                if (todo == null)
                    return NotFound(new { message = "Todo not found" });

                var tags = await _context.Tags
                    .Where(tag => dto.TagIds.Contains(tag.Id) && tag.UserId == userId)
                    .ToListAsync();

                todo.Tags.Clear();
                foreach (var tag in tags)
                {
                    todo.Tags.Add(tag);
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "Todo etiketleri güncellendi." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating todo tags");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        [HttpGet("calendar")]
        public async Task<ActionResult<Dictionary<string, List<TodoCalendarItemDto>>>> GetCalendar(
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string? month = null,
            [FromQuery] bool includeCompleted = true)
        {
            var (userId, isGuest) = await GetUserInfoAsync();
            if (isGuest)
                return StatusCode(403, new { message = "Misafir kullanıcılar takvim görünümüne erişemez." });

            DateTime startDateUtc, endDateUtc;

            if (!string.IsNullOrWhiteSpace(month))
            {
                // "YYYY-MM" formatında ay
                if (!DateTime.TryParse($"{month}-01", out var monthStartLocal))
                    return BadRequest(new { message = "month parametresi 'YYYY-MM' formatında olmalı." });

                startDateUtc = DateTime.SpecifyKind(new DateTime(monthStartLocal.Year, monthStartLocal.Month, 1), DateTimeKind.Utc);
                endDateUtc   = startDateUtc.AddMonths(1).AddDays(-1);
            }
            else
            {
                startDateUtc = from?.Date.ToUniversalTime() ?? DateTime.UtcNow.Date.AddDays(-15);
                endDateUtc   = to?.Date.ToUniversalTime()   ?? DateTime.UtcNow.Date.AddDays(45);

                if (endDateUtc < startDateUtc)
                    return BadRequest(new { message = "to, from tarihinden küçük olamaz." });
            }

            var query = _context.Todos
                .AsNoTracking()
                .Where(t => t.UserId == userId &&
                            t.DueDate.HasValue &&
                            t.DueDate.Value.Date >= startDateUtc.Date &&
                            t.DueDate.Value.Date <= endDateUtc.Date);

            if (!includeCompleted)
                query = query.Where(t => !t.IsCompleted);

            var items = await query
                .Include(t => t.Tags)
                .Select(t => new
                {
                    Date = t.DueDate!.Value.Date,
                    Item = new TodoCalendarItemDto(
                        t.Id,
                        t.Title,
                        t.IsCompleted,
                        t.DueDate,
                        t.Tags.Select(tag => new TagDto { Id = tag.Id, Name = tag.Name }).ToList()
                    )
                })
                .ToListAsync();

            var result = items
                .GroupBy(x => x.Date.ToString("yyyy-MM-dd"))
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => x.Item).ToList()
                );

            return Ok(result);
        }
    }
}
