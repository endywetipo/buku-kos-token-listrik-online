<?php
require_once __DIR__ . '/config.php';
check_login();
header('Location: dashboard.php');
exit;
