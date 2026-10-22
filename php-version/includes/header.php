<?php
$page_title = $page_title ?? 'BukuKos Online';
$active_page = $active_page ?? '';
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($page_title) ?> — BukuKos Online</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="assets/style.css" rel="stylesheet">
</head>
<body>

<nav class="navbar navbar-expand-lg navbar-dark bk-navbar shadow-sm">
  <div class="container">
    <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="dashboard.php">
      <i class="bi bi-house-door-fill"></i> BukuKos Online
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navMain">
      <ul class="navbar-nav ms-auto gap-lg-1">
        <li class="nav-item"><a class="nav-link <?= $active_page==='dashboard'?'active':'' ?>" href="dashboard.php"><i class="bi bi-speedometer2"></i> Dashboard</a></li>
        <li class="nav-item"><a class="nav-link <?= $active_page==='kamar'?'active':'' ?>" href="kamar.php"><i class="bi bi-door-closed"></i> Kamar</a></li>
        <li class="nav-item"><a class="nav-link <?= $active_page==='penghuni'?'active':'' ?>" href="penghuni.php"><i class="bi bi-people"></i> Penghuni</a></li>
        <li class="nav-item"><a class="nav-link <?= $active_page==='pembayaran'?'active':'' ?>" href="pembayaran-kos.php"><i class="bi bi-cash-stack"></i> Pembayaran Kos</a></li>
        <li class="nav-item"><a class="nav-link <?= $active_page==='token'?'active':'' ?>" href="token-listrik.php"><i class="bi bi-lightning-charge"></i> Token Listrik</a></li>
        <li class="nav-item ms-lg-2"><a class="btn btn-outline-light btn-sm px-3" href="auth/logout.php"><i class="bi bi-box-arrow-right"></i> Keluar</a></li>
      </ul>
    </div>
  </div>
</nav>

<div class="container py-4">
