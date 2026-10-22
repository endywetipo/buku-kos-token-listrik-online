<?php
require_once __DIR__ . '/config.php';
check_login();

$page_title = 'Dashboard';
$active_page = 'dashboard';

// Statistik
$total_kamar = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS jml FROM kamar"))['jml'] ?? 0;
$total_penghuni = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COUNT(*) AS jml FROM penghuni WHERE status='aktif'"))['jml'] ?? 0;

$bulan_ini = (int)date('n');
$tahun_ini = (int)date('Y');
$stmt = mysqli_prepare($conn, "SELECT COALESCE(SUM(jumlah),0) AS total FROM pembayaran_kos WHERE bulan = ? AND tahun = ? AND status='lunas'");
$bln_nama = nama_bulan($bulan_ini);
mysqli_stmt_bind_param($stmt, 'si', $bln_nama, $tahun_ini);
mysqli_stmt_execute($stmt);
$masuk_bulan_ini = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt))['total'] ?? 0;

$total_token = mysqli_fetch_assoc(mysqli_query($conn, "SELECT COALESCE(SUM(harga),0) AS total FROM token_listrik WHERE MONTH(tanggal) = $bulan_ini AND YEAR(tanggal) = $tahun_ini"))['total'] ?? 0;

// Kamar status overview
$kamar_list = mysqli_query($conn, "SELECT k.*, COALESCE(p.nama,'-') AS penghuni_nama FROM kamar k LEFT JOIN penghuni p ON p.kamar_id = k.id AND p.status='aktif' ORDER BY k.nomor_kamar");

// Pembayaran terbaru
$terbaru = mysqli_query($conn, "SELECT pk.*, p.nama AS penghuni_nama, k.nomor_kamar FROM pembayaran_kos pk JOIN penghuni p ON pk.penghuni_id = p.id LEFT JOIN kamar k ON pk.kamar_id = k.id ORDER BY pk.created_at DESC LIMIT 5");

include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <div>
    <h3 class="fw-bold mb-0" style="color:#17358f;">Dashboard</h3>
    <p class="text-muted mb-0">Selamat datang, <strong><?= htmlspecialchars($_SESSION['nama']) ?></strong></p>
  </div>
  <span class="badge bg-light text-dark px-3 py-2 rounded-pill"><?= nama_bulan($bulan_ini) . ' ' . $tahun_ini ?></span>
</div>

<!-- Stat cards -->
<div class="row g-3 mb-4">
  <div class="col-6 col-lg-3">
    <div class="stat-card stat-blue">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="stat-label">Total Kamar</div><div class="stat-value"><?= $total_kamar ?></div></div>
        <i class="bi bi-door-closed stat-icon"></i>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="stat-card stat-green">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="stat-label">Penghuni Aktif</div><div class="stat-value"><?= $total_penghuni ?></div></div>
        <i class="bi bi-people stat-icon"></i>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="stat-card stat-teal">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="stat-label">Pemasukan Bulan Ini</div><div class="stat-value"><?= rupiah($masuk_bulan_ini) ?></div></div>
        <i class="bi bi-cash-coin stat-icon"></i>
      </div>
    </div>
  </div>
  <div class="col-6 col-lg-3">
    <div class="stat-card stat-purple">
      <div class="d-flex justify-content-between align-items-start">
        <div><div class="stat-label">Token Listrik Terjual</div><div class="stat-value"><?= rupiah($total_token) ?></div></div>
        <i class="bi bi-lightning-charge stat-icon"></i>
      </div>
    </div>
  </div>
</div>

<!-- Status kamar -->
<div class="row g-3">
  <div class="col-lg-7">
    <div class="card h-100">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span><i class="bi bi-grid"></i> Status Kamar</span>
        <a href="kamar.php" class="btn btn-sm btn-outline-primary">Kelola <i class="bi bi-arrow-right"></i></a>
      </div>
      <div class="card-body">
        <div class="row g-2">
          <?php while ($k = mysqli_fetch_assoc($kamar_list)): ?>
            <div class="col-6 col-md-4">
              <div class="border rounded-3 p-3 text-center <?= $k['status']==='isi'?'border-success bg-light':'border-secondary' ?>">
                <div class="fw-bold" style="color:#17358f;">Kamar <?= htmlspecialchars($k['nomor_kamar']) ?></div>
                <span class="bk-badge <?= $k['status']==='isi'?'bk-badge-isi':'bk-badge-kosong' ?> mt-1"><?= $k['status']==='isi'?'Isi':'Kosong' ?></span>
                <div class="small text-muted mt-1"><?= htmlspecialchars($k['penghuni_nama']) ?></div>
              </div>
            </div>
          <?php endwhile; ?>
          <?php if ($total_kamar == 0): ?>
            <div class="col-12 text-center text-muted py-4">Belum ada kamar. <a href="kamar.php">Tambah kamar</a></div>
          <?php endif; ?>
        </div>
      </div>
    </div>
  </div>

  <div class="col-lg-5">
    <div class="card h-100">
      <div class="card-header"><i class="bi bi-clock-history"></i> Pembayaran Terbaru</div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-sm mb-0 align-middle">
            <thead><tr><th>Penghuni</th><th>Kamar</th><th>Bulan</th><th>Status</th></tr></thead>
            <tbody>
              <?php while ($t = mysqli_fetch_assoc($terbaru)): ?>
                <tr>
                  <td class="fw-semibold"><?= htmlspecialchars($t['penghuni_nama']) ?></td>
                  <td><?= htmlspecialchars($t['nomor_kamar'] ?? '-') ?></td>
                  <td><?= htmlspecialchars($t['bulan']) ?> <?= $t['tahun'] ?></td>
                  <td><span class="bk-badge <?= $t['status']==='lunas'?'bk-badge-lunas':'bk-badge-belum' ?>"><?= $t['status']==='lunas'?'Lunas':'Belum' ?></span></td>
                </tr>
              <?php endwhile; ?>
              <?php if (mysqli_num_rows($terbaru) == 0): ?>
                <tr><td colspan="4" class="text-center text-muted py-4">Belum ada pembayaran</td></tr>
              <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
