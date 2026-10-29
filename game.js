

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const overlay = $("overlay");
const overlayTitle = $("overlayTitle");
const overlayText = $("overlayText");
const startButton = $("startButton");

const W = canvas.width;
const H = canvas.height;

let best = 0;

try {
    best = Number(localStorage.getItem("galacticStrikeBest")) || 0;
} catch {}

$("best").textContent = best;

const keys = {};

let player;
let bullets;
let enemies;
let asteroids;
let stars;
let particles;

let score = 0;
let health = 100;
let level = 1;

let running = false;
let paused = false;
let gameOver = false;

let enemyTimer = 0;
let asteroidTimer = 0;
let lastTime = 0;
let animationId = 0;

function makeStars() {
    return Array.from({ length: 100 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 2 + 0.5,
        speed: 20 + Math.random() * 70
    }));
}

stars = makeStars();

function resetGame() {
    player = {
        x: W / 2,
        y: H - 75,
        radius: 16,
        speed: 270,
        cooldown: 0,
        invulnerable: 0
    };

    bullets = [];
    enemies = [];
    asteroids = [];
    particles = [];

    score = 0;
    health = 100;
    level = 1;

    enemyTimer = 0.7;
    asteroidTimer = 2;
    lastTime = 0;

    paused = false;
    gameOver = false;
    running = true;

    overlay.classList.add("hidden");
    startButton.textContent = "RESTART MISSION";

    updateUI();
}

function updateUI() {
    $("score").textContent = score;
    $("health").textContent = Math.max(0, Math.ceil(health));
    $("level").textContent = level;
    $("best").textContent = best;
}

function background(dt) {
    ctx.fillStyle = "#050817";
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
        if (running && !paused) {
            star.y += star.speed * dt;

            if (star.y > H) {
                star.y = 0;
                star.x = Math.random() * W;
            }
        }

        ctx.fillStyle = star.size > 1.5 ? "#8feaff" : "#536baf";

        ctx.globalAlpha = 0.45 + star.size / 4;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;

    // Distant planet
    const gradient = ctx.createRadialGradient(
        650, 135, 5, 650, 135, 75
    );

    gradient.addColorStop(0, "#553f98");
    gradient.addColorStop(0.7, "#202b68");
    gradient.addColorStop(1, "rgba(20,25,65,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(650, 135, 75, 0, Math.PI * 2);
    ctx.fill();
}

function drawShip(x, y, radius, color, enemy = false) {
    ctx.save();
    ctx.translate(x, y);

    if (enemy) {
        ctx.rotate(Math.PI);
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.5);
    ctx.lineTo(radius, radius);
    ctx.lineTo(0, radius * 0.55);
    ctx.lineTo(-radius, radius);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#dffaff";
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.2, radius * 0.25, radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function spawnEnemy() {
    const radius = 13 + Math.random() * 5;
    const maxHp = 1 + Math.floor(level / 3);

    enemies.push({
        x: radius + Math.random() * (W - radius * 2),
        y: -30,
        radius,
        hp: maxHp,
        maxHp,
        speed: 65 + Math.random() * 45 + level * 5,
        color: Math.random() < 0.5 ? "#ff477e" : "#ff7b54",
        phase: Math.random() * Math.PI * 2,
        shootTimer: 2 + Math.random() * 3
    });
}

function spawnAsteroid() {
    const radius = 10 + Math.random() * 16;

    asteroids.push({
        x: radius + Math.random() * (W - radius * 2),
        y: -radius,
        radius,
        speed: 65 + Math.random() * 90,
        rotation: Math.random() * 6,
        spin: (Math.random() - 0.5) * 2
    });
}

function explode(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 150;

        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.35 + Math.random() * 0.5,
            maxLife: 0.85,
            size: 2 + Math.random() * 3,
            color
        });
    }
}

function shoot() {
    bullets.push({
        x: player.x - 7,
        y: player.y - 15,
        vx: 0,
        vy: -470,
        damage: 1,
        color: "#00e5ff"
    });

    bullets.push({
        x: player.x + 7,
        y: player.y - 15,
        vx: 0,
        vy: -470,
        damage: 1,
        color: "#00e5ff"
    });
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function damagePlayer(amount) {
    if (player.invulnerable > 0) return;

    health -= amount;
    player.invulnerable = 0.8;

    explode(player.x, player.y, "#ff477e", 8);

    if (health <= 0) {
        health = 0;
        finishGame();
    }

    updateUI();
}

function finishGame() {
    running = false;
    gameOver = true;

    best = Math.max(best, score);

    try {
        localStorage.setItem("galacticStrikeBest", best);
    } catch {}

    $("best").textContent = best;

    overlay.classList.remove("hidden");
    overlayTitle.textContent = "MISSION FAILED";
    overlayText.textContent = `Final score: ${score}. The galaxy needs you, pilot!`;
    startButton.textContent = "PLAY AGAIN";
}

function update(dt) {
    if (!running || paused || gameOver) return;

    level = 1 + Math.floor(score / 150);

    const dx =
        (keys.ArrowRight || keys.d ? 1 : 0) -
        (keys.ArrowLeft || keys.a ? 1 : 0);

    const dy =
        (keys.ArrowDown || keys.s ? 1 : 0) -
        (keys.ArrowUp || keys.w ? 1 : 0);

    const length = Math.hypot(dx, dy) || 1;

    player.x += dx / length * player.speed * dt;
    player.y += dy / length * player.speed * dt;

    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(25, Math.min(H - 25, player.y));

    player.cooldown -= dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (keys[" "] && player.cooldown <= 0) {
        shoot();
        player.cooldown = 0.2;
    }

    enemyTimer -= dt;

    if (enemyTimer <= 0) {
        spawnEnemy();
        enemyTimer = Math.max(0.35, 1.1 - level * 0.06);
    }

    asteroidTimer -= dt;

    if (asteroidTimer <= 0) {
        spawnAsteroid();
        asteroidTimer = 1.4 + Math.random() * 1.6;
    }

    // Enemy movement
    for (const e of enemies) {
        e.y += e.speed * dt;
        e.x += Math.sin(e.y * 0.012 + e.phase) * 45 * dt;

        e.shootTimer -= dt;

        if (e.shootTimer <= 0) {
            e.shootTimer = 2.5 + Math.random() * 2;
        }

        if (distance(player, e) < player.radius + e.radius) {
            e.dead = true;
            damagePlayer(12);
        }
    }

    // Asteroids
    for (const a of asteroids) {
        a.y += a.speed * dt;
        a.rotation += a.spin * dt;

        if (distance(player, a) < player.radius + a.radius * 0.7) {
            a.dead = true;
            damagePlayer(18);
        }
    }

    // Player lasers
    for (const b of bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.y < -20) {
            b.dead = true;
            continue;
        }

        for (const e of enemies) {
            if (e.dead) continue;

            if (distance(b, e) < e.radius + 4) {
                b.dead = true;
                e.hp -= b.damage;

                if (e.hp <= 0) {
                    e.dead = true;
                    score += 10;
                    explode(e.x, e.y, e.color);
                }

                break;
            }
        }
    }

    enemies = enemies.filter(e => !e.dead && e.y < H + 50);
    asteroids = asteroids.filter(a => !a.dead && a.y < H + 50);
    bullets = bullets.filter(b => !b.dead);

    // Explosion particles
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);

    updateUI();
}

function draw() {
    background(running && !paused ? 1 / 60 : 0);

    for (const a of asteroids) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rotation);

        ctx.fillStyle = "#777b96";
        ctx.strokeStyle = "#c1c7e0";
        ctx.lineWidth = 2;

        ctx.beginPath();

        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const r = a.radius * (0.75 + 0.25 * Math.sin(i * 4));

            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    for (const e of enemies) {
        drawShip(e.x, e.y, e.radius, e.color, true);

        ctx.fillStyle = "#40182d";
        ctx.fillRect(e.x - 15, e.y - e.radius - 9, 30, 3);

        ctx.fillStyle = "#ff477e";
        ctx.fillRect(
            e.x - 15, e.y - e.radius - 9,
            30 * Math.max(0, e.hp / e.maxHp), 3
        );
    }

    for (const b of bullets) {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(b.x - 2, b.y - 9, 4, 15);
        ctx.shadowBlur = 0;
    }

    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.globalAlpha = 1;

    if (player && (!running || player.invulnerable <= 0 ||
        Math.floor(performance.now() / 100) % 2 === 0)) {
        drawShip(player.x, player.y, player.radius, "#00e5ff");
    }

    if (paused) {
        ctx.fillStyle = "rgba(2,5,18,0.72)";
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#00e5ff";
        ctx.textAlign = "center";
        ctx.font = "bold 32px Arial";
        ctx.fillText("PAUSED", W / 2, H / 2);
    }
}

function loop(time) {
    const dt = lastTime
        ? Math.min((time - lastTime) / 1000, 0.04)
        : 0;

    lastTime = time;

    update(dt);
    draw();

    animationId = requestAnimationFrame(loop);
}

function togglePause() {
    if (!running || gameOver) return;

    paused = !paused;
}

document.addEventListener("keydown", event => {
    if ([
        "ArrowUp", "ArrowDown", "ArrowLeft",
        "ArrowRight", " "
    ].includes(event.key)) {
        event.preventDefault();
    }

    keys[event.key] = true;

    if (event.key.toLowerCase() === "p") {
        togglePause();
    }
});

document.addEventListener("keyup", event => {
    keys[event.key] = false;
});

startButton.addEventListener("click", () => {
    resetGame();
});

function showStartScreen() {
    resetGame();
    running = false;

    overlay.classList.remove("hidden");
    overlayTitle.textContent = "READY FOR LAUNCH?";
    overlayText.textContent =
        "Pilot your spacecraft. Destroy enemies. Survive the galaxy.";
    startButton.textContent = "LAUNCH MISSION";

    draw();
}

showStartScreen();
cancelAnimationFrame(animationId);
requestAnimationFrame(loop);
