<?php
require_once __DIR__ . '/config.php';
check_login();

$page_title = 'Pembayaran Kos';
$active_page = 'pembayaran';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'add') {
        $penghuni_id = (int)$_POST['penghuni_id'];
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $bulan = trim($_POST['bulan'] ?? '');
        $tahun = (int)($_POST['tahun'] ?? date('Y'));
        $jumlah = (int)($_POST['jumlah'] ?? 0);
        $tgl = $_POST['tanggal_bayar'] ?? null;
        $status = $_POST['status'] ?? 'belum';
        if ($penghuni_id && $bulan) {
            $stmt = mysqli_prepare($conn, "INSERT INTO pembayaran_kos (penghuni_id, kamar_id, bulan, tahun, jumlah, tanggal_bayar, status) VALUES (?,?,?,?,?,?,?)");
            mysqli_stmt_bind_param($stmt, 'iisiiss', $penghuni_id, $kamar_id, $bulan, $tahun, $jumlah, $tgl, $status);
            mysqli_stmt_execute($stmt);
        }
    } elseif ($action === 'edit') {
        $id = (int)$_POST['id'];
        $penghuni_id = (int)$_POST['penghuni_id'];
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $bulan = trim($_POST['bulan'] ?? '');
        $tahun = (int)($_POST['tahun'] ?? date('Y'));
        $jumlah = (int)($_POST['jumlah'] ?? 0);
        $tgl = $_POST['tanggal_bayar'] ?? null;
        $status = $_POST['status'] ?? 'belum';
        $stmt = mysqli_prepare($conn, "UPDATE pembayaran_kos SET penghuni_id=?, kamar_id=?, bulan=?, tahun=?, jumlah=?, tanggal_bayar=?, status=? WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'iisiissi', $penghuni_id, $kamar_id, $bulan, $tahun, $jumlah, $tgl, $status, $id);
        mysqli_stmt_execute($stmt);
    } elseif ($action === 'delete') {
        $id = (int)$_POST['id'];
        $stmt = mysqli_prepare($conn, "DELETE FROM pembayaran_kos WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'i', $id);
        mysqli_stmt_execute($stmt);
    }
    header('Location: pembayaran-kos.php');
    exit;
}

$list = mysqli_query($conn, "SELECT pk.*, p.nama AS penghuni_nama, k.nomor_kamar FROM pembayaran_kos pk JOIN penghuni p ON pk.penghuni_id = p.id LEFT JOIN kamar k ON pk.kamar_id = k.id ORDER BY pk.tahun DESC, pk.created_at DESC");
$penghuni_opts = mysqli_query($conn, "SELECT id, nama, kamar_id FROM penghuni WHERE status='aktif' ORDER BY nama");
$kamar_opts = mysqli_query($conn, "SELECT id, nomor_kamar FROM kamar ORDER BY nomor_kamar");
$bulan_arr = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h3 class="fw-bold mb-0" style="color:#17358f;"><i class="bi bi-cash-stack"></i> Pembayaran Kos</h3>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalAdd"><i class="bi bi-plus-lg"></i> Catat Pembayaran</button>
</div>

<div class="card">
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>No</th><th>Penghuni</th><th>Kamar</th><th>Bulan</th><th>Jumlah</th><th>Tgl Bayar</th><th>Status</th><th class="text-end">Aksi</th></tr></thead>
        <tbody>
          <?php $no=1; while ($r = mysqli_fetch_assoc($list)): ?>
            <tr>
              <td class="text-muted"><?= $no++ ?></td>
              <td class="fw-bold" style="color:#17358f;"><?= htmlspecialchars($r['penghuni_nama']) ?></td>
              <td><?= htmlspecialchars($r['nomor_kamar'] ?? '-') ?></td>
              <td><?= htmlspecialchars($r['bulan']) ?> <?= $r['tahun'] ?></td>
              <td class="fw-semibold"><?= rupiah($r['jumlah']) ?></td>
              <td><?= $r['tanggal_bayar'] ?: '-' ?></td>
              <td><span class="bk-badge <?= $r['status']==='lunas'?'bk-badge-lunas':'bk-badge-belum' ?>"><?= $r['status']==='lunas'?'Lunas':'Belum' ?></span></td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalEdit<?= $r['id'] ?>"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-bs-toggle="modal" data-bs-target="#modalDel<?= $r['id'] ?>"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
            <!-- Edit Modal -->
            <div class="modal fade" id="modalEdit<?= $r['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title">Edit Pembayaran</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body">
                    <input type="hidden" name="action" value="edit"><input type="hidden" name="id" value="<?= $r['id'] ?>">
                    <div class="mb-3"><label class="form-label">Penghuni</label><select name="penghuni_id" class="form-select" required><?php $po=mysqli_query($conn,"SELECT id,nama FROM penghuni ORDER BY nama"); while($p2=mysqli_fetch_assoc($po)): ?><option value="<?= $p2['id'] ?>" <?= $r['penghuni_id']==$p2['id']?'selected':'' ?>><?= htmlspecialchars($p2['nama']) ?></option><?php endwhile; ?></select></div>
                    <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">--</option><?php $ko2=mysqli_query($conn,"SELECT id,nomor_kamar FROM kamar ORDER BY nomor_kamar"); while($km2=mysqli_fetch_assoc($ko2)): ?><option value="<?= $km2['id'] ?>" <?= $r['kamar_id']==$km2['id']?'selected':'' ?>>Kamar <?= htmlspecialchars($km2['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
                    <div class="row"><div class="col mb-3"><label class="form-label">Bulan</label><select name="bulan" class="form-select"><?php foreach($bulan_arr as $b): ?><option <?= $r['bulan']===$b?'selected':'' ?>><?= $b ?></option><?php endforeach; ?></select></div>
                    <div class="col mb-3"><label class="form-label">Tahun</label><input type="number" name="tahun" class="form-control" value="<?= $r['tahun'] ?>"></div></div>
                    <div class="mb-3"><label class="form-label">Jumlah (Rp)</label><input type="number" name="jumlah" class="form-control" value="<?= $r['jumlah'] ?>" required></div>
                    <div class="mb-3"><label class="form-label">Tanggal Bayar</label><input type="date" name="tanggal_bayar" class="form-control" value="<?= $r['tanggal_bayar'] ?>"></div>
                    <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="belum" <?= $r['status']==='belum'?'selected':'' ?>>Belum</option><option value="lunas" <?= $r['status']==='lunas'?'selected':'' ?>>Lunas</option></select></div>
                  </div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
                </form>
              </div></div>
            </div>
            <!-- Delete Modal -->
            <div class="modal fade" id="modalDel<?= $r['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title text-danger">Hapus Pembayaran?</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body"><p>Hapus data pembayaran <strong><?= htmlspecialchars($r['penghuni_nama']) ?></strong> — <?= htmlspecialchars($r['bulan']) ?> <?= $r['tahun'] ?>?</p><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $r['id'] ?>"></div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-danger">Hapus</button></div>
                </form>
              </div></div>
            </div>
          <?php endwhile; ?>
          <?php if (mysqli_num_rows($list) == 0): ?>
            <tr><td colspan="8" class="text-center text-muted py-4">Belum ada pembayaran tercatat.</td></tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Add Modal -->
<div class="modal fade" id="modalAdd" tabindex="-1">
  <div class="modal-dialog"><div class="modal-content">
    <form method="post">
      <div class="modal-header"><h5 class="modal-title"><i class="bi bi-plus-lg"></i> Catat Pembayaran Kos</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" name="action" value="add">
        <div class="mb-3"><label class="form-label">Penghuni</label><select name="penghuni_id" class="form-select" required><option value="">-- Pilih penghuni --</option><?php while($p2=mysqli_fetch_assoc($penghuni_opts)): ?><option value="<?= $p2['id'] ?>"><?= htmlspecialchars($p2['nama']) ?></option><?php endwhile; ?></select></div>
        <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">--</option><?php while($km2=mysqli_fetch_assoc($kamar_opts)): ?><option value="<?= $km2['id'] ?>">Kamar <?= htmlspecialchars($km2['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
        <div class="row"><div class="col mb-3"><label class="form-label">Bulan</label><select name="bulan" class="form-select"><?php foreach($bulan_arr as $b): ?><option <?= $b===nama_bulan((int)date('n'))?'selected':'' ?>><?= $b ?></option><?php endforeach; ?></select></div>
        <div class="col mb-3"><label class="form-label">Tahun</label><input type="number" name="tahun" class="form-control" value="<?= date('Y') ?>"></div></div>
        <div class="mb-3"><label class="form-label">Jumlah (Rp)</label><input type="number" name="jumlah" class="form-control" value="300000" required></div>
        <div class="mb-3"><label class="form-label">Tanggal Bayar</label><input type="date" name="tanggal_bayar" class="form-control" value="<?= date('Y-m-d') ?>"></div>
        <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="belum">Belum</option><option value="lunas">Lunas</option></select></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
    </form>
  </div></div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
