-- Database: bukukos
-- Import file ini ke phpMyAdmin (XAMPP) untuk membuat seluruh tabel.

CREATE DATABASE IF NOT EXISTS bukukos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bukukos;

-- Admin / pengguna
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nama_lengkap VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kamar kos (7 pintu)
CREATE TABLE IF NOT EXISTS kamar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nomor_kamar VARCHAR(10) NOT NULL UNIQUE,
  status ENUM('kosong','isi') DEFAULT 'kosong',
  harga_bulanan INT DEFAULT 300000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data penghuni
CREATE TABLE IF NOT EXISTS penghuni (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(100) NOT NULL,
  no_hp VARCHAR(20),
  kamar_id INT,
  tanggal_masuk DATE,
  status ENUM('aktif','nonaktif') DEFAULT 'aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE SET NULL
);

-- Pembayaran kos bulanan
CREATE TABLE IF NOT EXISTS pembayaran_kos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penghuni_id INT NOT NULL,
  kamar_id INT,
  bulan VARCHAR(20) NOT NULL,
  tahun INT NOT NULL,
  jumlah INT NOT NULL,
  tanggal_bayar DATE,
  status ENUM('lunas','belum') DEFAULT 'belum',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penghuni_id) REFERENCES penghuni(id) ON DELETE CASCADE,
  FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE SET NULL
);

-- Token listrik
CREATE TABLE IF NOT EXISTS token_listrik (
  id INT AUTO_INCREMENT PRIMARY KEY,
  penghuni_id INT NOT NULL,
  kamar_id INT,
  kwh DECIMAL(10,2) NOT NULL,
  harga INT NOT NULL,
  nomor_token VARCHAR(50),
  tanggal DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (penghuni_id) REFERENCES penghuni(id) ON DELETE CASCADE,
  FOREIGN KEY (kamar_id) REFERENCES kamar(id) ON DELETE SET NULL
);

-- Akun admin default (password: admin123)
INSERT INTO users (username, password, nama_lengkap) VALUES
('admin', '$2y$10$N9qo8uLOickgx2ZMRZoMy.MQDQxVjJ6mF7nKQkqZgGh6eR7nKQkq', 'Administrator');
