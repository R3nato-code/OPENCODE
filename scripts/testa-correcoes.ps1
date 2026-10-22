$raiz = Split-Path -Parent $PSScriptRoot
$p = Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $raiz -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

function Http($rota, $metodo, $corpo, $sessao) {
  $argsHttp = @{ Uri = "http://localhost:3000/$rota"; Method = $metodo; ContentType = 'application/json'; Body = $corpo; UseBasicParsing = $true }
  if ($sessao) { $argsHttp['WebSession'] = $sessao }
  try { $r = Invoke-RestMethod @argsHttp; return @{ ok = $true; d = $r } }
  catch { $cod = $_.Exception.Response.StatusCode.value__; return @{ ok = $false; cod = $cod } }
}

"1. GET /api/turmas sem login (espera 401):"
$r = Http 'api/turmas' 'Get' $null $null
if ($r.ok) { "FALHA: $($r.d | ConvertTo-Json -Compress)" } else { "OK - bloqueado ($($r.cod))" }

"2. Login admin (sem sessao variable ainda):"
$r = Http 'api/auth/login' 'Post' '{"usuario":"admin","senha":"admin123"}' $null
"login: $($r.ok)"

"3. Criar sessão (Invoke-WebRequest -SessionVariable):"
$null = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"usuario":"admin","senha":"admin123"}' -SessionVariable s
$sess = Get-Variable -Name s -ValueOnly

"4. GET /api/turmas com sessão (espera 200):"
$r = Http 'api/turmas' 'Get' $null $sess
"ok=$($r.ok) turmas=$($r.d.Count)"

"5. Trocar a própria senha (admin123 -> teste12345):"
$r = Http 'api/auth/trocar-senha' 'Post' '{"atual":"admin123","nova":"teste12345"}' $sess
"ok=$($r.ok)"

"6. Login com a senha nova (espera ok):"
$r = Http 'api/auth/login' 'Post' '{"usuario":"admin","senha":"teste12345"}' $null
"login nova senha: $($r.ok)"

"7. Voltar a senha para admin123:"
$null = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -ContentType 'application/json' -Body '{"usuario":"admin","senha":"teste12345"}' -SessionVariable s2
$sess2 = Get-Variable -Name s2 -ValueOnly
$r = Http 'api/auth/trocar-senha' 'Post' '{"atual":"teste12345","nova":"admin123"}' $sess2
"ok=$($r.ok)"

"8. Renomear professor 1 (Adriana Prado -> Adriana Prado Lima):"
$r = Http 'api/admin/professores/1' 'Put' '{"nome":"Adriana Prado Lima"}' $sess
"ok=$($r.ok)"

"9. Ver o professor renomeado:"
$r = Http 'api/admin/professores' 'Get' $null $sess
"primeiro: $($r.d[0].nome) (aulas=$($r.d[0].aulas))"

"10. Editar aula (id 1 -> Robótica / prof 3):"
$r = Http 'api/admin/aulas/1' 'Put' '{"materia":"Robotica","professor_id":3}' $sess
"ok=$($r.ok)"

"11. Mover aula 1 para baixo:"
$r = Http 'api/admin/aulas/1/mover' 'Post' '{"direcao":"descer"}' $sess
"ok=$($r.ok)"
$g = Http 'api/admin/aulas/1' 'Get' $null $sess
"ordem 1 e 2 agora: [$($g.d.grade.'1'[0].materia)] e [$($g.d.grade.'1'[1].materia)]"

"12. Admin redefinir senha de um usuário (cria usuário teste):"
$r = Http 'api/admin/usuarios' 'Post' '{"nome":"Prof Teste","usuario":"prof.teste","senha":"velha123","papel":"aluno","turma_id":2}' $sess
"criar usuário: $($r.ok) id=$($r.d.id)"
$r = Http "api/admin/usuarios/$($r.d.id)/senha" 'Put' '{"senha":"novaSenha1"}' $sess
"redefinir senha: $($r.ok)"
$r = Http 'api/auth/login' 'Post' '{"usuario":"prof.teste","senha":"novaSenha1"}' $null
"login com senha redefinida: $($r.ok)"

"13. Sessão do admin continua válida (me):"
$r = Http 'api/auth/me' 'Get' $null $sess
"papel=$($r.d.papel)"

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
"servidor finalizado"
