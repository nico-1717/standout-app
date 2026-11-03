-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Creato il: Nov 03, 2026 alle 16:07
-- Versione del server: 8.0.45
-- Versione PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `my_nisama`
--

-- --------------------------------------------------------

--
-- Struttura della tabella `habit_achievements`
--

CREATE TABLE `habit_achievements` (
  `id` int UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 0xF09F8F86,
  `tier` enum('bronze','silver','gold','platinum') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bronze',
  `metric` enum('streak','total_checkins','perfect_days','completion_rate','habit_count','comeback') COLLATE utf8mb4_unicode_ci NOT NULL,
  `threshold` int NOT NULL DEFAULT '1',
  `scope` enum('habit','global') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'habit',
  `sort_order` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dump dei dati per la tabella `habit_achievements`
--

INSERT INTO `habit_achievements` (`id`, `code`, `name`, `description`, `icon`, `tier`, `metric`, `threshold`, `scope`, `sort_order`) VALUES
(1, 'streak_3', 'Primi passi', '3 giorni di fila su una stessa abitudine.', '🌱', 'bronze', 'streak', 3, 'habit', 10),
(2, 'streak_7', 'Una settimana', '7 giorni di fila. La costanza inizia qui.', '🔥', 'bronze', 'streak', 7, 'habit', 20),
(3, 'streak_21', 'Abitudine formata', '21 giorni di fila: ora è automatica.', '⚡️', 'silver', 'streak', 21, 'habit', 30),
(4, 'streak_66', 'Sessantasei', '66 giorni di fila, la soglia scientifica.', '🧠', 'gold', 'streak', 66, 'habit', 40),
(5, 'streak_100', 'Centenario', '100 giorni di fila su una singola abitudine.', '💯', 'gold', 'streak', 100, 'habit', 50),
(6, 'streak_365', 'Un anno intero', '365 giorni di fila. Leggenda.', '👑', 'platinum', 'streak', 365, 'habit', 60),
(7, 'checkins_50', 'Cinquanta spunte', '50 check-in totali.', '✅', 'bronze', 'total_checkins', 50, 'global', 70),
(8, 'checkins_250', 'Macchina da guerra', '250 check-in totali.', '🚀', 'silver', 'total_checkins', 250, 'global', 80),
(9, 'checkins_1000', 'Mille', '1000 check-in totali.', '🏆', 'platinum', 'total_checkins', 1000, 'global', 90),
(10, 'perfect_1', 'Giornata perfetta', 'Tutte le abitudini del giorno completate.', '🌟', 'bronze', 'perfect_days', 1, 'global', 100),
(11, 'perfect_7', 'Settimana perfetta', '7 giornate perfette.', '💎', 'silver', 'perfect_days', 7, 'global', 110),
(12, 'perfect_30', 'Mese perfetto', '30 giornate perfette.', '🪐', 'gold', 'perfect_days', 30, 'global', 120),
(13, 'rate_80', 'Ottanta per cento', '80% di completamento negli ultimi 30 giorni.', '📈', 'silver', 'completion_rate', 80, 'global', 130),
(14, 'rate_95', 'Quasi impeccabile', '95% di completamento negli ultimi 30 giorni.', '🎯', 'gold', 'completion_rate', 95, 'global', 140),
(15, 'habits_5', 'Sistema in piedi', '5 abitudini attive contemporaneamente.', '🧩', 'bronze', 'habit_count', 5, 'global', 150),
(16, 'habits_10', 'Routine completa', '10 abitudini attive contemporaneamente.', '🛠️', 'silver', 'habit_count', 10, 'global', 160),
(17, 'comeback_1', 'Ritorno', 'Ripresa dopo aver perso una streak di 7+ giorni.', '🔁', 'bronze', 'comeback', 1, 'global', 170);

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `habit_achievements`
--
ALTER TABLE `habit_achievements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_hach_code` (`code`);

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `habit_achievements`
--
ALTER TABLE `habit_achievements`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
