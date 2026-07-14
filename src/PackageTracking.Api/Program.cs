using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add controllers.
builder.Services.AddControllers();

// Connect Entity Framework Core to SQL Server.
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// Allow the React frontend to call the API.
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// Add OpenAPI support.
builder.Services.AddOpenApi();

var app = builder.Build();

// Enable OpenAPI during development.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Apply the React CORS policy.
app.UseCors("ReactFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();