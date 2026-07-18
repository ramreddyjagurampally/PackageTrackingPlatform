using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly IConfiguration _configuration;

    public AuthController(
        UserManager<AppUser> userManager,
        IConfiguration configuration)
    {
        _userManager = userManager;
        _configuration = configuration;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(
        RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var fullName = request.FullName.Trim();

        if (string.IsNullOrWhiteSpace(fullName))
        {
            return BadRequest(new
            {
                message = "Full name is required."
            });
        }

        var existingUser =
            await _userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            return Conflict(new
            {
                message =
                    "An account already exists with this email."
            });
        }

        var user = new AppUser
        {
            FullName = fullName,
            Email = email,
            UserName = email
        };

        var createResult =
            await _userManager.CreateAsync(
                user,
                request.Password);

        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                message = "Registration failed.",
                errors = createResult.Errors.Select(error =>
                    error.Description)
            });
        }

        var roleResult =
            await _userManager.AddToRoleAsync(
                user,
                "Customer");

        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);

            return BadRequest(new
            {
                message =
                    "The customer role could not be assigned."
            });
        }

        return Ok(await CreateAuthResponseAsync(user));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user =
            await _userManager.FindByEmailAsync(email);

        if (user is null)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        var passwordIsCorrect =
            await _userManager.CheckPasswordAsync(
                user,
                request.Password);

        if (!passwordIsCorrect)
        {
            return Unauthorized(new
            {
                message = "Invalid email or password."
            });
        }

        return Ok(await CreateAuthResponseAsync(user));
    }

    private async Task<object> CreateAuthResponseAsync(
        AppUser user)
    {
        var roles =
            await _userManager.GetRolesAsync(user);

        var claims = new List<Claim>
        {
            new(
                JwtRegisteredClaimNames.Sub,
                user.Id.ToString()),

            new(
                JwtRegisteredClaimNames.Email,
                user.Email ?? string.Empty),

            new(
                JwtRegisteredClaimNames.Jti,
                Guid.NewGuid().ToString()),

            new(
                ClaimTypes.NameIdentifier,
                user.Id.ToString()),

            new(
                ClaimTypes.Name,
                user.FullName)
        };

        foreach (var role in roles)
        {
            claims.Add(
                new Claim(ClaimTypes.Role, role));
        }

        var jwtKey =
            _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException(
                "JWT key was not configured.");

        var jwtIssuer =
            _configuration["Jwt:Issuer"]
            ?? "PackageTracking.Api";

        var jwtAudience =
            _configuration["Jwt:Audience"]
            ?? "PackageTracking.Web";

        var expirationMinutes =
            int.TryParse(
                _configuration["Jwt:ExpirationMinutes"],
                out var configuredMinutes)
                ? configuredMinutes
                : 60;

        var expiresAtUtc =
            DateTime.UtcNow.AddMinutes(expirationMinutes);

        var signingCredentials =
            new SigningCredentials(
                new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtKey)),
                SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAtUtc,
            signingCredentials: signingCredentials);

        var tokenValue =
            new JwtSecurityTokenHandler()
                .WriteToken(token);

        return new
        {
            token = tokenValue,
            expiresAtUtc,
            user = new
            {
                user.Id,
                user.FullName,
                user.Email,
                roles
            }
        };
    }
}