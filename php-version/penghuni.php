<?php
require_once __DIR__ . '/config.php';
check_login();

$page_title = 'Manajemen Penghuni';
$active_page = 'penghuni';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'add') {
        $nama = trim($_POST['nama'] ?? '');
        $no_hp = trim($_POST['no_hp'] ?? '');
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $tgl = $_POST['tanggal_masuk'] ?? null;
        $status = $_POST['status'] ?? 'aktif';
        if ($nama !== '') {
            $stmt = mysqli_prepare($conn, "INSERT INTO penghuni (nama, no_hp, kamar_id, tanggal_masuk, status) VALUES (?,?,?,?,?)");
            mysqli_stmt_bind_param($stmt, 'ssiss', $nama, $no_hp, $kamar_id, $tgl, $status);
            mysqli_stmt_execute($stmt);
            if ($kamar_id && $status === 'aktif') {
                mysqli_query($conn, "UPDATE kamar SET status='isi' WHERE id=" . (int)$kamar_id);
            }
        }
    } elseif ($action === 'edit') {
        $id = (int)$_POST['id'];
        $nama = trim($_POST['nama'] ?? '');
        $no_hp = trim($_POST['no_hp'] ?? '');
        $kamar_id = (int)($_POST['kamar_id'] ?? 0) ?: null;
        $tgl = $_POST['tanggal_masuk'] ?? null;
        $status = $_POST['status'] ?? 'aktif';
        $old = mysqli_fetch_assoc(mysqli_query($conn, "SELECT kamar_id FROM penghuni WHERE id=$id"));
        $stmt = mysqli_prepare($conn, "UPDATE penghuni SET nama=?, no_hp=?, kamar_id=?, tanggal_masuk=?, status=? WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'ssissi', $nama, $no_hp, $kamar_id, $tgl, $status, $id);
        mysqli_stmt_execute($stmt);
        if ($old['kamar_id']) mysqli_query($conn, "UPDATE kamar SET status='kosong' WHERE id=" . (int)$old['kamar_id']);
        if ($kamar_id && $status === 'aktif') mysqli_query($conn, "UPDATE kamar SET status='isi' WHERE id=" . (int)$kamar_id);
    } elseif ($action === 'delete') {
        $id = (int)$_POST['id'];
        $old = mysqli_fetch_assoc(mysqli_query($conn, "SELECT kamar_id FROM penghuni WHERE id=$id"));
        $stmt = mysqli_prepare($conn, "DELETE FROM penghuni WHERE id=?");
        mysqli_stmt_bind_param($stmt, 'i', $id);
        mysqli_stmt_execute($stmt);
        if ($old['kamar_id']) mysqli_query($conn, "UPDATE kamar SET status='kosong' WHERE id=" . (int)$old['kamar_id']);
    }
    header('Location: penghuni.php');
    exit;
}

$penghuni_list = mysqli_query($conn, "SELECT p.*, k.nomor_kamar FROM penghuni p LEFT JOIN kamar k ON p.kamar_id = k.id ORDER BY p.nama");
$kamar_options = mysqli_query($conn, "SELECT id, nomor_kamar FROM kamar ORDER BY nomor_kamar");

include __DIR__ . '/includes/header.php';
?>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h3 class="fw-bold mb-0" style="color:#17358f;"><i class="bi bi-people"></i> Manajemen Penghuni</h3>
  <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalAdd"><i class="bi bi-plus-lg"></i> Tambah Penghuni</button>
</div>

<div class="card">
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead><tr><th>No</th><th>Nama</th><th>No HP</th><th>Kamar</th><th>Tgl Masuk</th><th>Status</th><th class="text-end">Aksi</th></tr></thead>
        <tbody>
          <?php $no=1; while ($p = mysqli_fetch_assoc($penghuni_list)): ?>
            <tr>
              <td class="text-muted"><?= $no++ ?></td>
              <td class="fw-bold" style="color:#17358f;"><?= htmlspecialchars($p['nama']) ?></td>
              <td><?= htmlspecialchars($p['no_hp'] ?: '-') ?></td>
              <td><?= htmlspecialchars($p['nomor_kamar'] ?? '-') ?></td>
              <td><?= $p['tanggal_masuk'] ?: '-' ?></td>
              <td><span class="bk-badge <?= $p['status']==='aktif'?'bk-badge-aktif':'bk-badge-nonaktif' ?>"><?= $p['status']==='aktif'?'Aktif':'Nonaktif' ?></span></td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalEdit<?= $p['id'] ?>"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-bs-toggle="modal" data-bs-target="#modalDel<?= $p['id'] ?>"><i class="bi bi-trash"></i></button>
              </td>
            </tr>
            <!-- Edit Modal -->
            <div class="modal fade" id="modalEdit<?= $p['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title">Edit Penghuni</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body">
                    <input type="hidden" name="action" value="edit"><input type="hidden" name="id" value="<?= $p['id'] ?>">
                    <div class="mb-3"><label class="form-label">Nama</label><input type="text" name="nama" class="form-control" value="<?= htmlspecialchars($p['nama']) ?>" required></div>
                    <div class="mb-3"><label class="form-label">No HP</label><input type="text" name="no_hp" class="form-control" value="<?= htmlspecialchars($p['no_hp']) ?>"></div>
                    <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">-- Tidak ada --</option><?php $ko=mysqli_query($conn,"SELECT id,nomor_kamar FROM kamar ORDER BY nomor_kamar"); while($km=mysqli_fetch_assoc($ko)): ?><option value="<?= $km['id'] ?>" <?= $p['kamar_id']==$km['id']?'selected':'' ?>>Kamar <?= htmlspecialchars($km['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
                    <div class="mb-3"><label class="form-label">Tanggal Masuk</label><input type="date" name="tanggal_masuk" class="form-control" value="<?= $p['tanggal_masuk'] ?>"></div>
                    <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="aktif" <?= $p['status']==='aktif'?'selected':'' ?>>Aktif</option><option value="nonaktif" <?= $p['status']==='nonaktif'?'selected':'' ?>>Nonaktif</option></select></div>
                  </div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div>
                </form>
              </div></div>
            </div>
            <!-- Delete Modal -->
            <div class="modal fade" id="modalDel<?= $p['id'] ?>" tabindex="-1">
              <div class="modal-dialog"><div class="modal-content">
                <form method="post">
                  <div class="modal-header"><h5 class="modal-title text-danger">Hapus Penghuni?</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
                  <div class="modal-body"><p>Hapus <strong><?= htmlspecialchars($p['nama']) ?></strong>? Data pembayaran &amp; token terkait juga akan dihapus.</p><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $p['id'] ?>"></div>
                  <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-danger">Hapus</button></div>
                </form>
              </div></div>
            </div>
          <?php endwhile; ?>
          <?php if (mysqli_num_rows($penghuni_list) == 0): ?>
            <tr><td colspan="7" class="text-center text-muted py-4">Belum ada penghuni.</td></tr>
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
      <div class="modal-header"><h5 class="modal-title"><i class="bi bi-plus-lg"></i> Tambah Penghuni</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" name="action" value="add">
        <div class="mb-3"><label class="form-label">Nama</label><input type="text" name="nama" class="form-control" required></div>
        <div class="mb-3"><label class="form-label">No HP</label><input type="text" name="no_hp" class="form-control"></div>
        <div class="mb-3"><label class="form-label">Kamar</label><select name="kamar_id" class="form-select"><option value="">-- Tidak ada --</option><?php while($km=mysqli_fetch_assoc($kamar_options)): ?><option value="<?= $km['id'] ?>">Kamar <?= htmlspecialchars($km['nomor_kamar']) ?></option><?php endwhile; ?></select></div>
        <div class="mb-3"><label class="form-label">Tanggal Masuk</label><input type="date" name="tanggal_masuk" class="form-control"></div>
        <div class="mb-3"><label class="form-label">Status</label><select name="status" class="form-select"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div>
      </div>
      <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button><button type="submit" class="btn btn-primary">Tambah</button></div>
    </form>
  </div></div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
