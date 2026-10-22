<?php
require_once __DIR__ . '/../config.php';

if (isset($_SESSION['user_id'])) {
    header('Location: ../dashboard.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $password === '') {
        $error = 'Username dan password wajib diisi.';
    } else {
        $stmt = mysqli_prepare($conn, "SELECT id, username, password, nama_lengkap FROM users WHERE username = ?");
        mysqli_stmt_bind_param($stmt, 's', $username);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        $user = mysqli_fetch_assoc($result);

        if ($user && password_verify($password, $user['password'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['nama'] = $user['nama_lengkap'];
            header('Location: ../dashboard.php');
            exit;
        } else {
            $error = 'Username atau password salah.';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — BukuKos Online</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="../assets/style.css" rel="stylesheet">
</head>
<body class="login-body">

<div class="login-card">
  <div class="login-icon"><i class="bi bi-house-door-fill"></i></div>
  <h3 class="text-center fw-bold mb-1" style="color:#17358f;">BukuKos Online</h3>
  <p class="text-center text-muted small mb-4">Pembayaran Kos &amp; Token Listrik</p>

  <?php if ($error): ?>
    <div class="alert alert-danger py-2 small"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>

  <form method="post">
    <div class="mb-3">
      <label class="form-label fw-semibold small">Username</label>
      <div class="input-group">
        <span class="input-group-text bg-light"><i class="bi bi-person"></i></span>
        <input type="text" name="username" class="form-control" placeholder="Masukkan username" autofocus>
      </div>
    </div>
    <div class="mb-4">
      <label class="form-label fw-semibold small">Password</label>
      <div class="input-group">
        <span class="input-group-text bg-light"><i class="bi bi-lock"></i></span>
        <input type="password" name="password" class="form-control" placeholder="Masukkan password" id="pwd">
        <button class="btn btn-outline-secondary" type="button" onclick="const p=document.getElementById('pwd');p.type=p.type==='password'?'text':'password';this.querySelector('i').className=p.type==='password'?'bi bi-eye':'bi bi-eye-slash';"><i class="bi bi-eye"></i></button>
      </div>
    </div>
    <button type="submit" class="btn btn-primary"><i class="bi bi-box-arrow-in-right"></i> Login</button>
  </form>

  <p class="text-center text-muted small mt-3 mb-0">Default: <strong>admin</strong> / <strong>admin123</strong></p>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
