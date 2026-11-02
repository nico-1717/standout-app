<?php
/* Genera il test d'oro degli eventi del planner: il SITO (pl_events_range) calcola cosa si vede in ogni periodo;
   il telefono deve dare lo stesso. Uso (dal sito, col database locale):
     php /percorso/standout-app/scripts/gen-planner-events.php > src/features/planner/__tests__/fixtures/events.json
   Scrive nel database LOCALE righe di prova dell'utente «altro» e le toglie alla fine. */
// da riga di comando il sito crede di essere in una richiesta web: gli si dice che e' locale
$_SERVER['SERVER_NAME'] = $_SERVER['HTTP_HOST'] = 'localhost'; $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$sito = getenv('STANDOUT_SITE') ?: '/home/claude/standout';
require_once $sito . '/lib/bootstrap.php';
require_once $sito . '/lib/security_core.php';
require_once $sito . '/lib/planner/planner_lib.php';
require_once $sito . '/lib/sync_api.php';

$u = sec_one("SELECT id FROM users WHERE username = 'altro'");
$uid = (int)$u['id'];
$T = 'gold-evt ';
sec_q("DELETE FROM planner_events WHERE user_id = ? AND title LIKE ?", [$uid, $T . '%']);

function ins(int $uid, array $r): int {
    $d = $r + ['title' => 'x', 'event_date' => '2026-11-01', 'end_date' => null, 'start_time' => '09:00:00', 'end_time' => '10:00:00',
               'is_all_day' => 0, 'rrule' => null, 'repeat_type' => 'none', 'repeat_interval' => 1, 'repeat_unit' => 'week', 'repeat_until' => null,
               'series_id' => null, 'original_date' => null, 'is_cancelled' => 0, 'sort_order' => 0, 'importance' => 'normal', 'color' => null, 'item_type' => 'event',
               'is_completed' => 0, 'notify_type' => 'h1', 'notify_minutes' => 60];
    $cols = array_keys($d);
    sec_q("INSERT INTO planner_events (user_id, " . implode(',', $cols) . ") VALUES (?," . implode(',', array_fill(0, count($cols), '?')) . ")", array_merge([$uid], array_values($d)));
    return (int)sec_insert_id();
}
$T2 = fn($s) => $T . $s;
$ids = [];
$ids['solo']      = ins($uid, ['title' => $T2('solo'), 'event_date' => '2026-11-10', 'start_time' => '14:00:00', 'end_time' => '15:30:00']);
$ids['tuttogg']   = ins($uid, ['title' => $T2('tutto il giorno'), 'event_date' => '2026-11-10', 'is_all_day' => 1, 'start_time' => '00:00:00', 'end_time' => '00:00:00']);
$ids['lungo']     = ins($uid, ['title' => $T2('lungo'), 'event_date' => '2026-10-28', 'end_date' => '2026-11-03']);
$ids['lungo2']    = ins($uid, ['title' => $T2('lungo che finisce dopo'), 'event_date' => '2026-11-29', 'end_date' => '2026-12-04']);
$ids['stesso1']   = ins($uid, ['title' => $T2('stessa ora b'), 'event_date' => '2026-11-12', 'start_time' => '09:00:00', 'sort_order' => 2]);
$ids['stesso2']   = ins($uid, ['title' => $T2('stessa ora a'), 'event_date' => '2026-11-12', 'start_time' => '09:00:00', 'sort_order' => 1]);
$ids['notte']     = ins($uid, ['title' => $T2('scavalca la notte'), 'event_date' => '2026-11-14', 'end_date' => '2026-11-15', 'start_time' => '22:00:00', 'end_time' => '02:00:00']);

$ids['sett'] = ins($uid, ['title' => $T2('settimanale'), 'event_date' => '2026-10-05', 'rrule' => 'FREQ=WEEKLY', 'repeat_type' => 'weekly', 'start_time' => '18:00:00', 'end_time' => '19:00:00']);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['sett']]);
$ids['sett_spost'] = ins($uid, ['title' => $T2('settimanale spostata'), 'event_date' => '2026-11-12', 'start_time' => '19:00:00', 'end_time' => '20:00:00', 'series_id' => $ids['sett'], 'original_date' => '2026-11-09']);
$ids['sett_canc']  = ins($uid, ['title' => 'Cancellato', 'event_date' => '2026-11-16', 'start_time' => '00:00:00', 'end_time' => '00:00:00', 'series_id' => $ids['sett'], 'original_date' => '2026-11-16', 'is_cancelled' => 1]);
$ids['sett_fuori'] = ins($uid, ['title' => $T2('settimanale spostata lontano'), 'event_date' => '2027-03-01', 'series_id' => $ids['sett'], 'original_date' => '2026-11-23']);
$ids['sett_indietro'] = ins($uid, ['title' => $T2('settimanale portata indietro'), 'event_date' => '2026-10-31', 'series_id' => $ids['sett'], 'original_date' => '2026-12-07']);

$ids['tre'] = ins($uid, ['title' => $T2('serie di tre giorni'), 'event_date' => '2026-11-02', 'end_date' => '2026-11-04', 'rrule' => 'FREQ=WEEKLY;INTERVAL=2', 'repeat_type' => 'custom']);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['tre']]);
$ids['mese31'] = ins($uid, ['title' => $T2('mensile al 31'), 'event_date' => '2026-01-31', 'rrule' => 'FREQ=MONTHLY', 'repeat_type' => 'monthly', 'start_time' => '08:00:00']);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['mese31']]);
$ids['finita'] = ins($uid, ['title' => $T2('finita'), 'event_date' => '2026-09-01', 'rrule' => 'FREQ=DAILY;UNTIL=20260915T235959Z', 'repeat_type' => 'daily', 'repeat_until' => '2026-09-15']);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['finita']]);
$ids['conta'] = ins($uid, ['title' => $T2('con conteggio'), 'event_date' => '2026-11-04', 'rrule' => 'FREQ=DAILY;COUNT=3', 'repeat_type' => 'custom']);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['conta']]);
$ids['annuale'] = ins($uid, ['title' => $T2('annuale'), 'event_date' => '2020-11-18', 'rrule' => 'FREQ=YEARLY', 'repeat_type' => 'yearly', 'is_all_day' => 1]);
sec_q("UPDATE planner_events SET series_id = id WHERE id = ?", [$ids['annuale']]);

$mioIds = array_values($ids);
$daId = array_flip($ids);
$wire = sync_leggi_righe('planner_events', $uid, null);
$uuidDi = []; $righe = [];
foreach ($wire as $w) {
    if (!in_array($w['_id'], $mioIds, true)) continue;
    $uuidDi[$w['_id']] = $w['uuid'];
    $righe[] = $w;
}
// il nome dato alla riga nel test (non l'id numerico del database, che cambia a ogni giro)
$nome = []; foreach ($ids as $k => $id) $nome[$uuidDi[$id]] = $k;
foreach ($righe as &$r) unset($r['_id']); unset($r);

$periodi = [['2026-11-01', '2026-11-30'], ['2026-11-09', '2026-11-09'], ['2026-11-10', '2026-11-16'], ['2026-10-26', '2026-11-08'],
            ['2026-11-30', '2026-12-13'], ['2026-12-01', '2026-12-31'], ['2027-02-22', '2027-03-07'], ['2026-09-10', '2026-09-20'],
            ['2026-11-14', '2026-11-15'], ['2026-11-16', '2026-11-22'], ['2026-11-23', '2026-11-29']];
$casi = [];
foreach ($periodi as [$f, $t]) {
    $ev = [];
    foreach (pl_events_range($uid, $f, $t) as $e) {
        if (!in_array($e['master_id'], $mioIds, true) && !in_array($e['id'], $mioIds, true)) continue;
        $ev[] = ['name' => $nome[$uuidDi[$e['id']]], 'master' => $nome[$uuidDi[$e['master_id']]], 'title' => $e['title'], 'date' => $e['date'], 'end_date' => $e['end_date'],
                 'giorni' => $e['giorni'], 'start' => $e['start'], 'end' => $e['end'], 'all_day' => $e['all_day'], 'occ_date' => $e['occ_date'],
                 'is_occurrence' => $e['is_occurrence'], 'multiday' => $e['multiday']];
    }
    $casi[] = ['from' => $f, 'to' => $t, 'events' => $ev];
}
sec_q("DELETE FROM planner_events WHERE user_id = ? AND title LIKE ?", [$uid, $T . '%']);
sec_q("DELETE FROM planner_events WHERE user_id = ? AND title = 'Cancellato'", [$uid]);
fwrite(STDOUT, json_encode(['_comment' => "Casi d'oro degli eventi, generati dal SITO (pl_events_range, scripts/gen-planner-events.php).", 'names' => $nome, 'rows' => $righe, 'cases' => $casi], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n");
