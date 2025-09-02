using Microsoft.AspNetCore.Authorization;
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

        public TodosController(ApplicationDbContext context, ILogger<TodosController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string GetCurrentUserId()
        {
            return User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        }

        // GET: api/todos
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

        // GET: api/todos/5
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

        // POST: api/todos
        [HttpPost]
        public async Task<ActionResult<Todo>> PostTodo(TodoCreateDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                
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

                return CreatedAtAction(nameof(GetTodo), new { id = todo.Id }, todo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating todo");
                return StatusCode(500, new { message = "Internal server error" });
            }
        }

        // PUT: api/todos/5
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

        // DELETE: api/todos/5
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