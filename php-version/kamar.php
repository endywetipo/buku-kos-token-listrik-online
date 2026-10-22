<?php
require_once __DIR__ . '/config.php';
check_login();

$page_title = 'Manajemen Kamar';
$active_page = 'kamar';

// Handle actions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'add') {
        $nomor = trim($_POST['nomor_kamar'] ?? '');
        $status = $_POST['status'] ?? 'kosong';
        $harga = (int)($_POST['harga_bulanan'] ?? 300000);
        if ($nomor !== '') {
            $stmt = mysqli_prepare($conn, "INSERT INTO kamar (nomor_kamar, status, harga_bulanan) VALUES (?,?,?)");
            mysqli_stmt_bind_param($stmt, 'ssi', $nomor, $status, $harga);
            mysqli_stmt_execute($stmt);
        }
    } elseif ($action === 'edit') {
        $id = (int)$_POST['id'];
        $nomor = trim($_POST['nomor_kamar'] ?? '');
        $status = $_POST['status'] ?? 'kosong';
        $harga = (int)($_POST['harga_bulanan'] ?? 300000);
        $stmt = mysqli_prepare($conn, "UPDATE kamar SET nomor_kamar=?, status=?, harga_bulanan=? WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'ssii', $nomor, $status, $harga, $id);
        mysqli_stmt_execute($stmt);
    } elseif ($action === 'delete') {
        $id = (int)$_POST['id'];
        $stmt = mysqli_prepare($conn, "DELETE FROM kamar WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'i', $id);
        mysqli_stmt_execute($stmt);
    }
    header('Location: kamar.php');
    exit;
}

$kamar_list = mysqli_query($conn, "SELECT k.*, COALESCE(p.nama,'-') AS penghuni_nama FROM kamar k LEFT JOIN penghuni p ON p.kamar_id = k.id AND p.status='aktif' ORDER BY k.nomor_kamar");

include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h3 class="fw-bold mb-0" style="color:#17358f;"><i class="bi bi-door-closed"></i> Manajemen Kamar</h3>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalAdd"><i class="bi bi-plus-lg"></i> Tambah Kamar</button>
</div>

<div class="card">
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>No</th><th>Kamar</th><th>Status</th><th>Penghuni</th><th>Harga Bulanan</th><th class="text-end">Aksi</th></tr></thead>
        <tbody>
          <?php $no=1; while ($k = mysqli_fetch_assoc($kamar_list)): ?>
            <tr>
              <td class="text-muted"><?= $no++ ?></td>
              <td class="fw-bold" style="color:#17358f;">Kamar <?= htmlspecialchars($k['nomor_kamar']) ?></td>
              <td><span class="bk-badge <?= $k['status']==='isi'?'bk-badge-isi':'bk-badge-kosong' ?>"><?= $k['status']==='isi'?'Isi':'Kosong' ?></span></td>
              <td><?= htmlspecialchars($k['penghuni_nama']) ?></td>
              <td><?= rupiah($k['harga_bulanan']) ?></td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalEdit<?= $k['id'] ?>"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-bs-toggle="modal" data-bs-target="#modalDel<?= $k['id'] ?>"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
            <!-- Edit Modal -->
            <div class="modal fade" id="modalEdit<?= $k['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title">Edit Kamar <?= htmlspecialchars($k['nomor_kamar']) ?></h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body">
                    <input type="hidden" name="action" value="edit"><input type="hidden" name="id" value="<?= $k['id'] ?>">
                    <div class="mb-3"><label class="form-label">Nomor Kamar</label><input type="text" name="nomor_kamar" class="form-control" value="<?= htmlspecialchars($k['nomor_kamar']) ?>" required></div>
                    <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="kosong" <?= $k['status']==='kosong'?'selected':'' ?>>Kosong</option><option value="isi" <?= $k['status']==='isi'?'selected':'' ?>>Isi</option></select></div>
                    <div class="mb-3"><label class="form-label">Harga Bulanan</label><input type="number" name="harga_bulanan" class="form-control" value="<?= $k['harga_bulanan'] ?>" required></div>
                  </div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
                </form>
              </div></div>
            </div>
            <!-- Delete Modal -->
            <div class="modal fade" id="modalDel<?= $k['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title text-danger">Hapus Kamar?</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body"><p>Hapus kamar <strong><?= htmlspecialchars($k['nomor_kamar']) ?></strong>? Data pembayaran terkait juga dapat terpengaruh.</p><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $k['id'] ?>"></div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-danger">Hapus</button></div>
                </form>
              </div></div>
            </div>
          <?php endwhile; ?>
          <?php if (mysqli_num_rows($kamar_list) == 0): ?>
            <tr><td colspan="6" class="text-center text-muted py-4">Belum ada kamar. Klik "Tambah Kamar" untuk menambah.</td></tr>
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
      <div class="modal-header"><h5 class="modal-title"><i class="bi bi-plus-lg"></i> Tambah Kamar</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" name="action" value="add">
        <div class="mb-3"><label class="form-label">Nomor Kamar</label><input type="text" name="nomor_kamar" class="form-control" placeholder="cth: 1, 2, 3A" required></div>
        <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="kosong">Kosong</option><option value="isi">Isi</option></select></div>
        <div class="mb-3"><label class="form-label">Harga Bulanan (Rp)</label><input type="number" name="harga_bulanan" class="form-control" value="300000" required></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Tambah</button></div>
    </form>
  </div></div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
