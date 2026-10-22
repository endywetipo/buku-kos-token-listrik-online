<?php
require_once __DIR__ . '/config.php';
check_login();

$page_title = 'Token Listrik';
$active_page = 'token';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'add') {
        $penghuni_id = (int)$_POST['penghuni_id'];
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $kwh = (float)$_POST['kwh'];
        $harga = (int)$_POST['harga'];
        $nomor = trim($_POST['nomor_token'] ?? '');
        $tgl = $_POST['tanggal'] ?? date('Y-m-d');
        if ($penghuni_id && $kwh > 0) {
            $stmt = mysqli_prepare($conn, "INSERT INTO token_listrik (penghuni_id, kamar_id, kwh, harga, nomor_token, tanggal) VALUES (?,?,?,?,?,?)");
            mysqli_stmt_bind_param($stmt, 'iidiss', $penghuni_id, $kamar_id, $kwh, $harga, $nomor, $tgl);
            mysqli_stmt_execute($stmt);
        }
    } elseif ($action === 'edit') {
        $id = (int)$_POST['id'];
        $penghuni_id = (int)$_POST['penghuni_id'];
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $kwh = (float)$_POST['kwh'];
        $harga = (int)$_POST['harga'];
        $nomor = trim($_POST['nomor_token'] ?? '');
        $tgl = $_POST['tanggal'] ?? date('Y-m-d');
        $stmt = mysqli_prepare($conn, "UPDATE token_listrik SET penghuni_id=?, kamar_id=?, kwh=?, harga=?, nomor_token=?, tanggal=? WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'iidissi', $penghuni_id, $kamar_id, $kwh, $harga, $nomor, $tgl, $id);
        mysqli_stmt_execute($stmt);
    } elseif ($action === 'delete') {
        $id = (int)$_POST['id'];
        $stmt = mysqli_prepare($conn, "DELETE FROM token_listrik WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'i', $id);
        mysqli_stmt_execute($stmt);
    }
    header('Location: token-listrik.php');
    exit;
}

$list = mysqli_query($conn, "SELECT t.*, p.nama AS penghuni_nama, k.nomor_kamar FROM token_listrik t JOIN penghuni p ON t.penghuni_id = p.id LEFT JOIN kamar k ON t.kamar_id = k.id ORDER BY t.tanggal DESC, t.created_at DESC");
$penghuni_opts = mysqli_query($conn, "SELECT id, nama FROM penghuni WHERE status='aktif' ORDER BY nama");
$kamar_opts = mysqli_query($conn, "SELECT id, nomor_kamar FROM kamar ORDER BY nomor_kamar");

include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h3 class="fw-bold mb-0" style="color:#17358f;"><i class="bi bi-lightning-charge"></i> Token Listrik</h3>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalAdd"><i class="bi bi-plus-lg"></i> Catat Token</button>
</div>

<div class="card">
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>No</th><th>Penghuni</th><th>Kamar</th><th>kWh</th><th>Harga</th><th>No. Token</th><th>Tanggal</th><th class="text-end">Aksi</th></tr></thead>
        <tbody>
          <?php $no=1; while ($r = mysqli_fetch_assoc($list)): ?>
            <tr>
              <td class="text-muted"><?= $no++ ?></td>
              <td class="fw-bold" style="color:#17358f;"><?= htmlspecialchars($r['penghuni_nama']) ?></td>
              <td><?= htmlspecialchars($r['nomor_kamar'] ?? '-') ?></td>
              <td><?= number_format($r['kwh'], 2, ',', '.') ?> kWh</td>
              <td class="fw-semibold"><?= rupiah($r['harga']) ?></td>
              <td><?= htmlspecialchars($r['nomor_token'] ?: '-') ?></td>
              <td><?= $r['tanggal'] ?></td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalEdit<?= $r['id'] ?>"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-bs-toggle="modal" data-bs-target="#modalDel<?= $r['id'] ?>"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
            <!-- Edit Modal -->
            <div class="modal fade" id="modalEdit<?= $r['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title">Edit Token Listrik</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body">
                    <input type="hidden" name="action" value="edit"><input type="hidden" name="id" value="<?= $r['id'] ?>">
                    <div class="mb-3"><label class="form-label">Penghuni</label><select name="penghuni_id" class="form-select" required><?php $po=mysqli_query($conn,"SELECT id,nama FROM penghuni ORDER BY nama"); while($p2=mysqli_fetch_assoc($po)): ?><option value="<?= $p2['id'] ?>" <?= $r['penghuni_id']==$p2['id']?'selected':'' ?>><?= htmlspecialchars($p2['nama']) ?></option><?php endwhile; ?></select></div>
                    <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">--</option><?php $ko2=mysqli_query($conn,"SELECT id,nomor_kamar FROM kamar ORDER BY nomor_kamar"); while($km2=mysqli_fetch_assoc($ko2)): ?><option value="<?= $km2['id'] ?>" <?= $r['kamar_id']==$km2['id']?'selected':'' ?>>Kamar <?= htmlspecialchars($km2['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
                    <div class="mb-3"><label class="form-label">Jumlah kWh</label><input type="number" step="0.01" name="kwh" class="form-control" value="<?= $r['kwh'] ?>" required></div>
                    <div class="mb-3"><label class="form-label">Harga (Rp)</label><input type="number" name="harga" class="form-control" value="<?= $r['harga'] ?>" required></div>
                    <div class="mb-3"><label class="form-label">Nomor Token</label><input type="text" name="nomor_token" class="form-control" value="<?= htmlspecialchars($r['nomor_token']) ?>"></div>
                    <div class="mb-3"><label class="form-label">Tanggal</label><input type="date" name="tanggal" class="form-control" value="<?= $r['tanggal'] ?>"></div>
                  </div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
                </form>
              </div></div>
            </div>
            <!-- Delete Modal -->
            <div class="modal fade" id="modalDel<?= $r['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title text-danger">Hapus Token?</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body"><p>Hapus data token <strong><?= htmlspecialchars($r['penghuni_nama']) ?></strong> — <?= number_format($r['kwh'],2,',','.') ?> kWh?</p><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $r['id'] ?>"></div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-danger">Hapus</button></div>
                </form>
              </div></div>
            </div>
          <?php endwhile; ?>
          <?php if (mysqli_num_rows($list) == 0): ?>
            <tr><td colspan="8" class="text-center text-muted py-4">Belum ada token tercatat.</td></tr>
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
      <div class="modal-header"><h5 class="modal-title"><i class="bi bi-plus-lg"></i> Catat Token Listrik</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" name="action" value="add">
        <div class="mb-3"><label class="form-label">Penghuni</label><select name="penghuni_id" class="form-select" required><option value="">-- Pilih penghuni --</option><?php while($p2=mysqli_fetch_assoc($penghuni_opts)): ?><option value="<?= $p2['id'] ?>"><?= htmlspecialchars($p2['nama']) ?></option><?php endwhile; ?></select></div>
        <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">--</option><?php while($km2=mysqli_fetch_assoc($kamar_opts)): ?><option value="<?= $km2['id'] ?>">Kamar <?= htmlspecialchars($km2['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
        <div class="mb-3"><label class="form-label">Jumlah kWh</label><input type="number" step="0.01" name="kwh" class="form-control" placeholder="cth: 20.50" required></div>
        <div class="mb-3"><label class="form-label">Harga (Rp)</label><input type="number" name="harga" class="form-control" placeholder="cth: 50000" required></div>
        <div class="mb-3"><label class="form-label">Nomor Token</label><input type="text" name="nomor_token" class="form-control" placeholder="opsional"></div>
        <div class="mb-3"><label class="form-label">Tanggal</label><input type="date" name="tanggal" class="form-control" value="<?= date('Y-m-d') ?>"></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
    </form>
  </div></div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
