$raiz = Split-Path -Parent $PSScriptRoot
$p = Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $raiz -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

$null = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"usuario":"admin","senha":"admin123"}' -SessionVariable s
$sess = Get-Variable -Name s -ValueOnly

"1. Aulas do professor 1 (novo endpoint):"
$r = Invoke-RestMethod http://localhost:3000/api/admin/professores/1/aulas -WebSession $sess
"professor: $($r.professor.nome) | total: $($r.aulas.Count) | primeira: $($r.aulas[0].turma_nome) dia $($r.aulas[0].dia) ordem $($r.aulas[0].ordem) ($($r.aulas[0].materia))"

"2. Sem sessao no novo endpoint (espera 401):"
try { Invoke-RestMethod http://localhost:3000/api/admin/professores/1/aulas; "FALHA: passou!" } catch { "OK bloqueado ($($_.Exception.Response.StatusCode.value__))" }

"3. Limpar aula 1 via PUT (materia vazia + sem professor):"
$aula = (Invoke-RestMethod http://localhost:3000/api/admin/aulas/1 -WebSession $sess).grade.'1'[0]
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/admin/aulas/$($aula.id)" -Method Put -ContentType 'application/json' -Body '{"materia":"","professor_id":""}' -WebSession $sess
"PUT: $($r.ok)"
$depois = (Invoke-RestMethod http://localhost:3000/api/admin/aulas/1 -WebSession $sess).grade.'1'[0]
"depois: materia='[$($depois.materia)]', professor='[$($depois.professor_id)]'"
$pub = Invoke-RestMethod http://localhost:3000/api/turmas -WebSession $sess
"aulas preenchidas na turma 1 depois de limpar: $($pub | Where-Object id -eq 1 | Select-Object -ExpandProperty aulas_preenchidas)"

"4. Professor sem aulas (cria e testa 'Ver aulas' vazio):"
$novo = Invoke-RestMethod -Uri http://localhost:3000/api/admin/professores -Method Post -ContentType 'application/json' -Body '{"nome":"Professor Novo Teste"}' -WebSession $sess
$r = Invoke-RestMethod http://localhost:3000/api/admin/professores/$($novo.id)/aulas -WebSession $sess
"professor '$($r.professor.nome)' com $($r.aulas.Count) aulas"

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
"servidor finalizado"
