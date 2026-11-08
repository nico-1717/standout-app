<?php
/* Genera il test d'oro del pianificatore: il SITO (pn_pianifica, public/projects/piano_api.php) calcola il piano di
   molti scenari; il telefono (src/features/plan/engine.ts) deve dare gli stessi minuti, giorno per giorno.
   Uso (col database LOCALE del sito):
     php /percorso/standout-app/scripts/gen-plan-golden.php > src/features/plan/__tests__/fixtures/golden.json
   Crea un utente di prova («goldplan»), ci scrive progetti, obiettivi, pomodori ed eventi, e a fine lavoro lo toglie.
   Le funzioni del piano si prendono dal file del sito così come sono (nessuna copia a mano): l'unica modifica e' che
   «oggi» e' fisso (la data di generazione), per poter rifare lo stesso conto fra un anno. */
$_SERVER['SERVER_NAME'] = $_SERVER['HTTP_HOST'] = 'localhost'; $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$sito = getenv('STANDOUT_SITE') ?: '/home/claude/standout';
require_once $sito . '/lib/bootstrap.php';
require_once $sito . '/lib/security_core.php';
date_default_timezone_set('Europe/Rome');

define('GOLD_OGGI', date('Y-m-d'));
$src = file_get_contents($sito . '/public/projects/piano_api.php');
$a = strpos($src, 'function pn_oggi()');
$b = strpos($src, "/* ---------------------------------------------------------------------\n   Piccoli accessori");
if ($a === false || $b === false) { fwrite(STDERR, "piano_api.php non ha la forma attesa\n"); exit(1); }
$codice = substr($src, $a, $b - $a);
$codice = str_replace("function pn_oggi(): string { return date('Y-m-d'); }", "function pn_oggi(): string { return GOLD_OGGI; }", $codice);
eval($codice);

/* ---------- l'utente di prova ---------- */
sec_q("DELETE FROM users WHERE username = 'goldplan'");
sec_q("INSERT INTO users (username, password_hash, is_active) VALUES ('goldplan', 'x', 1)");
$uid = (int)sec_one("SELECT id FROM users WHERE username = 'goldplan'")['id'];

function pulisci(int $uid): void {
    foreach (['plan_goals', 'plan_paint', 'plan_days', 'plan_settings', 'pomodoro_sessions', 'planner_events', 'projects'] as $t) {
        sec_q("DELETE FROM `$t` WHERE user_id = ?", [$uid], 'i');
    }
}

function giorno(int $n): string { return pn_piu(GOLD_OGGI, $n); }

/** Scrive uno scenario nel database e ne ritorna l'ingresso del telefono + il piano del sito. */
function esegui(int $uid, string $nome, array $sc): array {
    pulisci($uid);
    $ids = [];   // chiave => id
    $ord = 0;
    foreach ($sc['progetti'] as $p) {
        $padre = $p['padre'] ?? null;
        sec_q("INSERT INTO projects (user_id, parent_id, name, status, color, custom_order) VALUES (?,?,?,?,?,?)",
              [$uid, $padre === null ? null : $ids[$padre], $p['k'], $p['stato'] ?? 'in_progress', '#336699', $ord++], 'iisssi');
        $ids[$p['k']] = (int)sec_insert_id();
    }
    foreach ($sc['obiettivi'] as $k => $g) {
        $g += ['attivo' => 1, 'min' => 0, 'bloccato' => 0, 'tipo' => 'plain', 'prio' => 'should', 'inizio' => null, 'scad' => null, 'since' => null];
        sec_q("INSERT INTO plan_goals (user_id, project_id, active, minutes, locked, kind, priority, start_date, deadline, since) VALUES (?,?,?,?,?,?,?,?,?,?)",
              [$uid, $ids[$k], $g['attivo'], $g['min'], $g['bloccato'], $g['tipo'], $g['prio'], $g['inizio'], $g['scad'], $g['since']], 'iiiiisssss');
    }
    foreach ($sc['sessioni'] ?? [] as $s) {   // [chiave, giorno, minuti]
        $ini = $s[1] . ' 10:00:00';
        sec_q("INSERT INTO pomodoro_sessions (user_id, mode, start_time, end_time, status, duration_seconds, planned_duration_min, project_id, is_manual)
               VALUES (?,0,?,?,'completato',?,?,?,1)", [$uid, $ini, $s[1] . ' 11:00:00', $s[2] * 60, $s[2], $ids[$s[0]]], 'issiii');
    }
    foreach ($sc['manuali'] ?? [] as $m) {    // [chiave, giorno, minuti]
        sec_q("INSERT INTO plan_days (user_id, day, project_id, kind, minutes, source) VALUES (?,?,?,?,?, 'manual')", [$uid, $m[1], $ids[$m[0]], 'study', $m[2]], 'isisi');
    }
    foreach ($sc['evidenziati'] ?? [] as $e) { // [chiave, giorno]
        sec_q("INSERT IGNORE INTO plan_paint (user_id, project_id, day) VALUES (?,?,?)", [$uid, $ids[$e[0]], $e[1]], 'iis');
    }
    foreach ($sc['eventi'] ?? [] as $e) {     // [giorno, inizio, fine, tutto_il_giorno, importanza]
        sec_q("INSERT INTO planner_events (user_id, title, event_date, start_time, end_time, is_all_day, importance, item_type, notify_type, notify_minutes, repeat_type, repeat_interval, repeat_unit, is_cancelled, sort_order, is_completed)
               VALUES (?,?,?,?,?,?,?, 'event', 'h1', 60, 'none', 1, 'week', 0, 0, 0)",
              [$uid, 'gold', $e[0], $e[1], $e[2], $e[3], $e[4]], 'issssis');
    }
    $s = $sc['impostazioni'] ?? [];
    sec_q("INSERT INTO plan_settings (user_id, weekday_min, weekend_min, rest_dow, buffer_days, floor_min, max_subjects, reviews, overrides) VALUES (?,?,?,?,?,?,?,?,?)",
          [$uid, $s['wd'] ?? null, $s['we'] ?? null, $s['riposo'] ?? 0, $s['buffer'] ?? 0, $s['soglia'] ?? 15, $s['max'] ?? 3, $s['ripassi'] ?? 0,
           !empty($s['ov']) ? json_encode($s['ov']) : null], 'iiiiiiiis');

    $radice = isset($sc['radice']) ? $ids[$sc['radice']] : 0;
    $imp = pn_impostazioni($uid);
    $r = pn_pianifica($uid, $radice, $imp);
    $chi = array_flip($ids);   // id => chiave
    $p = $r['p'];

    /* l'ingresso come lo dà il telefono: tutto con le chiavi al posto degli id */
    $nodi = [];
    foreach ($p as $id => $n) $nodi[] = ['id' => $chi[$id], 'parent' => $n['parent'] === null ? null : $chi[$n['parent']], 'status' => $n['status'], 'kids' => array_map(fn($k) => $chi[$k], $n['kids'])];
    $obi = [];
    foreach (pn_obiettivi($uid) as $pid => $o) {
        $obi[$chi[$pid]] = ['active' => $o['active'], 'minutes' => $o['minutes'], 'locked' => $o['locked'], 'kind' => $o['kind'], 'priority' => $o['priority'],
                            'start' => $o['start'], 'deadline' => $o['deadline'], 'since' => $o['since'], 'items' => $o['items'], 'unitMinutes' => $o['unit_minutes']];
    }
    $fatto = [];
    foreach (pn_fatto($uid, '2000-01-01') as $pid => $gg) $fatto[$chi[$pid]] = $gg;
    $man = [];
    foreach (sec_all("SELECT day, project_id, minutes FROM plan_days WHERE user_id = ? AND source = 'manual' AND kind = 'study' AND day >= ?", [$uid, GOLD_OGGI], 'is') as $m)
        $man[(string)$m['day']][$chi[(int)$m['project_id']]] = (int)$m['minutes'];
    $dip = [];
    foreach (sec_all("SELECT project_id, day FROM plan_paint WHERE user_id = ? AND day >= ?", [$uid, GOLD_OGGI], 'is') as $m)
        $dip[$chi[(int)$m['project_id']]][] = (string)$m['day'];
    $occ = pn_occupato($uid, GOLD_OGGI, pn_piu(GOLD_OGGI, 400));
    $min = [];   // minuti di pomodoro per giorno (tutti i progetti): serve al ritmo misurato
    foreach (sec_all("SELECT DATE(start_time) AS g, SUM(COALESCE(duration_seconds,0)) / 60 AS m FROM pomodoro_sessions WHERE user_id = ? GROUP BY DATE(start_time)", [$uid], 'i') as $m)
        $min[(string)$m['g']] = (float)$m['m'];

    /* l'uscita del sito */
    $righe = [];
    foreach ($r['righe'] as $d => $per) foreach ($per as $pid => $k) $righe[$d][$chi[$pid]] = $k;
    $def = [];
    foreach ($r['deficit'] as $pid => $m) $def[$chi[$pid]] = $m;
    $info = [];
    foreach ($r['info'] as $pid => $u) {
        $info[$chi[$pid]] = ['resta' => $u['resta'], 'tot' => $u['tot'], 'fine' => $u['fine'], 'fineStudio' => $u['fineStudio'], 'utili' => $u['utili'],
                             'scad' => $u['scad'], 'ini' => $u['ini'], 'root' => $chi[$u['root']]];
    }
    return [
        'name' => $nome,
        'input' => [
            'today' => GOLD_OGGI, 'nodes' => $nodi, 'goals' => (object)$obi, 'done' => (object)array_map(fn($x) => (object)$x, $fatto),
            'manual' => (object)array_map(fn($x) => (object)$x, $man), 'painted' => (object)$dip, 'busy' => (object)$occ,
            'settings' => [
                'restDow' => $imp['rest_dow'], 'bufferDays' => $imp['buffer_days'], 'floorMin' => $imp['floor_min'], 'maxSubjects' => $imp['max_subjects'],
                'reviews' => $imp['reviews'], 'weekdayEff' => $imp['weekday_eff'], 'weekendEff' => $imp['weekend_eff'], 'overrides' => (object)$imp['overrides'],
            ],
            'root' => isset($sc['radice']) ? $sc['radice'] : null,
        ],
        'pace' => ['perDay' => (object)$min, 'measured' => pn_ritmo_misurato($uid)],
        'expected' => ['rows' => (object)array_map(fn($x) => (object)$x, $righe), 'deficit' => (object)$def, 'info' => (object)$info,
                       'days' => count($r['giorni']), 'end' => $r['fine'], 'dailyCount' => (int)($r['n_giornalieri'] ?? 0)],
    ];
}

$S = [];

$S['esame semplice'] = ['progetti' => [['k' => 'A']], 'obiettivi' => ['A' => ['min' => 6000, 'tipo' => 'exam', 'prio' => 'must', 'scad' => giorno(40), 'since' => GOLD_OGGI]],
                        'impostazioni' => ['wd' => 180, 'we' => 120]];
$S['due esami'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                   'obiettivi' => ['A' => ['min' => 3000, 'tipo' => 'exam', 'prio' => 'must', 'scad' => giorno(20)], 'B' => ['min' => 4500, 'tipo' => 'exam', 'prio' => 'should', 'scad' => giorno(35)]],
                   'impostazioni' => ['wd' => 240, 'we' => 180]];
$S['padre e figli'] = ['progetti' => [['k' => 'P'], ['k' => 'F1', 'padre' => 'P'], ['k' => 'F2', 'padre' => 'P'], ['k' => 'F3', 'padre' => 'P'], ['k' => 'N', 'padre' => 'F1']],
                       'obiettivi' => ['P' => ['min' => 6000, 'tipo' => 'exam', 'prio' => 'must', 'scad' => giorno(30), 'since' => GOLD_OGGI], 'F1' => ['min' => 2400, 'bloccato' => 1], 'F2' => ['min' => 1800], 'F3' => ['min' => 1800, 'prio' => 'nice']],
                       'sessioni' => [['F1', giorno(-1), 90], ['N', giorno(0), 30]], 'impostazioni' => ['wd' => 200, 'we' => 100]];
$S['ogni giorno'] = ['progetti' => [['k' => 'A'], ['k' => 'D'], ['k' => 'E']],
                     'obiettivi' => ['A' => ['min' => 3000, 'tipo' => 'exam', 'scad' => giorno(25)], 'D' => ['min' => 30, 'tipo' => 'daily'], 'E' => ['min' => 20, 'tipo' => 'daily', 'inizio' => giorno(3), 'scad' => giorno(10)]],
                     'impostazioni' => ['wd' => 120, 'we' => 60]];
$S['giorni evidenziati'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                            'obiettivi' => ['A' => ['min' => 1200, 'tipo' => 'course', 'scad' => giorno(30)], 'B' => ['min' => 900, 'tipo' => 'plain']],
                            'evidenziati' => [['A', giorno(2)], ['A', giorno(4)], ['A', giorno(5)], ['A', giorno(9)], ['A', giorno(12)], ['A', giorno(-3)], ['B', giorno(40)]],
                            'impostazioni' => ['wd' => 90, 'we' => 90, 'riposo' => 3]];
$S['fatto e a mano'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                        'obiettivi' => ['A' => ['min' => 2400, 'tipo' => 'exam', 'scad' => giorno(18), 'since' => giorno(-10)], 'B' => ['min' => 1500, 'prio' => 'nice', 'since' => giorno(-5)]],
                        'sessioni' => [['A', giorno(-8), 120], ['A', giorno(-6), 60], ['A', giorno(-1), 45], ['B', giorno(-2), 30]],
                        'manuali' => [['A', giorno(2), 60], ['B', giorno(2), 30], ['A', giorno(7), 90]], 'impostazioni' => ['wd' => 150, 'we' => 150]];
$S['riposo buffer ripassi'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                               'obiettivi' => ['A' => ['min' => 3600, 'tipo' => 'exam', 'prio' => 'must', 'scad' => giorno(21)], 'B' => ['min' => 2400, 'tipo' => 'exam', 'scad' => giorno(24)]],
                               'impostazioni' => ['wd' => 180, 'we' => 240, 'riposo' => 7, 'buffer' => 3, 'ripassi' => 1]];
$S['giorni speciali e impegni'] = ['progetti' => [['k' => 'A']],
                                   'obiettivi' => ['A' => ['min' => 3000, 'tipo' => 'exam', 'scad' => giorno(14)]],
                                   'eventi' => [[giorno(1), '09:00:00', '13:00:00', 0, 'normal'], [giorno(2), '00:00:00', '00:00:00', 1, 'high'], [giorno(3), '00:00:00', '00:00:00', 1, 'normal'], [giorno(4), '08:00:00', '23:30:00', 0, 'normal'], [giorno(5), '00:00:00', '00:00:00', 1, 'highest']],
                                   'impostazioni' => ['wd' => 240, 'we' => 200, 'ov' => [giorno(6) => 0, giorno(7) => 400, giorno(9) => 30]]];
$S['troppo stretto'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                        'obiettivi' => ['A' => ['min' => 9000, 'tipo' => 'exam', 'prio' => 'must', 'scad' => giorno(10)], 'B' => ['min' => 3000, 'tipo' => 'exam', 'scad' => giorno(12)]],
                        'impostazioni' => ['wd' => 120, 'we' => 60]];
$S['senza scadenza'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                        'obiettivi' => ['A' => ['min' => 1500, 'tipo' => 'steady', 'inizio' => giorno(5)], 'B' => ['min' => 600, 'tipo' => 'count', 'prio' => 'nice']],
                        'impostazioni' => ['wd' => 100, 'we' => 100]];
$S['rami spenti e finiti'] = ['progetti' => [['k' => 'A'], ['k' => 'A1', 'padre' => 'A'], ['k' => 'B'], ['k' => 'B1', 'padre' => 'B'], ['k' => 'C', 'stato' => 'completed']],
                              'obiettivi' => ['A' => ['min' => 1000, 'attivo' => 0], 'A1' => ['min' => 500], 'B' => ['min' => 800, 'scad' => giorno(15)], 'B1' => ['min' => 400, 'scad' => giorno(20)], 'C' => ['min' => 300]],
                              'impostazioni' => ['wd' => 100, 'we' => 100]];
$S['tante cose piccole'] = ['progetti' => [['k' => 'A'], ['k' => 'B'], ['k' => 'C'], ['k' => 'D'], ['k' => 'E']],
                            'obiettivi' => ['A' => ['min' => 120, 'scad' => giorno(14)], 'B' => ['min' => 90, 'scad' => giorno(14), 'prio' => 'must'], 'C' => ['min' => 150, 'scad' => giorno(20), 'prio' => 'nice'], 'D' => ['min' => 60], 'E' => ['min' => 200, 'scad' => giorno(9)]],
                            'impostazioni' => ['wd' => 90, 'we' => 60, 'soglia' => 30, 'max' => 2]];
$S['solo un ramo'] = ['progetti' => [['k' => 'A'], ['k' => 'A1', 'padre' => 'A'], ['k' => 'B']], 'radice' => 'A',
                      'obiettivi' => ['A1' => ['min' => 900, 'scad' => giorno(12)], 'B' => ['min' => 900, 'scad' => giorno(12)]], 'impostazioni' => ['wd' => 120, 'we' => 120]];
// ritmo misurato: nessun valore scelto, sessioni negli ultimi 60 giorni
$sess = [];
for ($i = 1; $i <= 40; $i++) { $m = [0 => 0, 1 => 100, 2 => 130, 3 => 75, 4 => 160][$i % 5]; if ($m > 0) $sess[] = ['A', giorno(-$i), $m]; }
$S['ritmo misurato'] = ['progetti' => [['k' => 'A'], ['k' => 'B']],
                        'obiettivi' => ['B' => ['min' => 2400, 'tipo' => 'exam', 'scad' => giorno(30)]], 'sessioni' => $sess];
$S['ritmo misurato poco'] = ['progetti' => [['k' => 'A']], 'obiettivi' => ['A' => ['min' => 1200, 'tipo' => 'exam', 'scad' => giorno(20)]], 'sessioni' => [['A', giorno(-1), 50], ['A', giorno(-2), 60]]];

/* scenari a caso: stessi numeri ad ogni lancio */
mt_srand(20261108);
$prio = ['must', 'should', 'nice']; $tipi = ['plain', 'exam', 'steady', 'course', 'count', 'daily'];
for ($n = 1; $n <= 60; $n++) {
    $pr = []; $keys = [];
    $tot = mt_rand(1, 7);
    for ($i = 0; $i < $tot; $i++) {
        $k = 'P' . $i;
        $padre = ($i > 0 && mt_rand(0, 2) > 0) ? $keys[mt_rand(0, $i - 1)] : null;
        $pr[] = ['k' => $k] + ($padre ? ['padre' => $padre] : []) + (mt_rand(0, 9) === 0 ? ['stato' => 'completed'] : []);
        $keys[] = $k;
    }
    $ob = [];
    foreach ($keys as $k) {
        if (mt_rand(0, 3) === 0) continue;
        $t = $tipi[mt_rand(0, 5)];
        $ob[$k] = ['min' => $t === 'daily' ? mt_rand(1, 6) * 10 : mt_rand(2, 150) * 30, 'tipo' => $t, 'prio' => $prio[mt_rand(0, 2)], 'attivo' => mt_rand(0, 9) === 0 ? 0 : 1,
                   'scad' => mt_rand(0, 2) > 0 ? giorno(mt_rand(3, 90)) : null, 'inizio' => mt_rand(0, 4) === 0 ? giorno(mt_rand(1, 12)) : null,
                   'since' => mt_rand(0, 1) ? giorno(-mt_rand(0, 30)) : null];
    }
    $sc = ['progetti' => $pr, 'obiettivi' => $ob, 'sessioni' => [], 'manuali' => [], 'evidenziati' => [], 'eventi' => []];
    for ($i = 0, $q = mt_rand(0, 8); $i < $q; $i++) $sc['sessioni'][] = [$keys[mt_rand(0, $tot - 1)], giorno(-mt_rand(0, 70)), mt_rand(1, 18) * 10];
    for ($i = 0, $q = mt_rand(0, 3); $i < $q; $i++) $sc['manuali'][] = [$keys[mt_rand(0, $tot - 1)], giorno(mt_rand(0, 20)), mt_rand(1, 12) * 10];
    for ($i = 0, $q = mt_rand(0, 6); $i < $q; $i++) $sc['evidenziati'][] = [$keys[mt_rand(0, $tot - 1)], giorno(mt_rand(-3, 40))];
    for ($i = 0, $q = mt_rand(0, 4); $i < $q; $i++) {
        $tutto = mt_rand(0, 3) === 0 ? 1 : 0; $h = mt_rand(6, 16);
        $sc['eventi'][] = [giorno(mt_rand(0, 30)), $tutto ? '00:00:00' : sprintf('%02d:00:00', $h), $tutto ? '00:00:00' : sprintf('%02d:30:00', $h + mt_rand(1, 6)), $tutto, ['normal', 'high', 'highest'][mt_rand(0, 2)]];
    }
    $ov = []; for ($i = 0, $q = mt_rand(0, 3); $i < $q; $i++) $ov[giorno(mt_rand(0, 40))] = mt_rand(0, 6) * 60;
    $sc['impostazioni'] = ['wd' => mt_rand(0, 3) ? mt_rand(2, 16) * 15 : null, 'we' => mt_rand(0, 3) ? mt_rand(0, 14) * 15 : null, 'riposo' => mt_rand(0, 3) === 0 ? mt_rand(1, 7) : 0,
                           'buffer' => mt_rand(0, 3) === 0 ? mt_rand(1, 5) : 0, 'soglia' => [10, 15, 20, 30, 45][mt_rand(0, 4)], 'max' => mt_rand(1, 5), 'ripassi' => mt_rand(0, 2) === 0 ? 1 : 0, 'ov' => $ov];
    if (mt_rand(0, 5) === 0) $sc['radice'] = $keys[mt_rand(0, $tot - 1)];
    $S['a caso ' . $n] = $sc;
}

$out = [];
foreach ($S as $nome => $sc) $out[] = esegui($uid, $nome, $sc);
pulisci($uid);
sec_q("DELETE FROM users WHERE id = ?", [$uid], 'i');
echo json_encode(['today' => GOLD_OGGI, 'scenarios' => $out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION), "\n";
