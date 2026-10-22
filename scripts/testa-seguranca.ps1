$raiz = Split-Path -Parent $PSScriptRoot
$p = Start-Process -FilePath node -ArgumentList 'server.js' -WorkingDirectory $raiz -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

function Requisicao($nome, $metodo, $rota, $corpo, $cookie) {
  $argsHttp = @{ Uri = "http://localhost:3000/$rota"; Method = $metodo; UseBasicParsing = $true }
  if ($corpo) { $argsHttp['ContentType'] = 'application/json'; $argsHttp['Body'] = $corpo }
  if ($cookie) { $argsHttp['Headers'] = @{ Cookie = $cookie } }
  try {
    $r = Invoke-WebRequest @argsHttp
    "{0,-10} status={1} corpo={2}" -f $nome, $r.StatusCode, ($r.Content -replace "`n", ' ')
  } catch {
    $st = $_.Exception.Response.StatusCode.value__
    $corpoErro = ''
    try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $corpoErro = $sr.ReadToEnd() } catch { }
    "{0,-10} status={1} corpo={2}" -f $nome, $st, ($corpoErro -replace "`n", ' ')
  }
}

"== 1. /data/escola.db bloqueado =="
Requisicao 'db' 'Get' 'data/escola.db' $null $null

"== 2. JSON malformado =="
Requisicao 'json' 'Post' 'api/auth/login' 'INVALID_JSON' $null

"== 3. Cookie adulterado =="
Requisicao 'cookie' 'Get' 'api/auth/me' $null 'sessao=eyJpZCI6MSwiZXhwIjo5OTk5OTk5OTk5OX0.assinaturafalsa'

"== 4. SQL injection no login =="
$corpoSqli = '{"usuario":"' + "'" + ' OR 1=1 --' + '","senha":"x"}'
Requisicao 'sqli' 'Post' 'api/auth/login' $corpoSqli $null

"== 5. Sem sessao em rota admin =="
Requisicao 'admin' 'Get' 'api/admin/usuarios' $null $null

"== 6. Headers de endurecimento =="
$h = (Invoke-WebRequest http://localhost:3000/ -UseBasicParsing).Headers
"X-Powered-By presente: $($h.ContainsKey('X-Powered-By')) | nosniff: $($h['X-Content-Type-Options'])"

"== 7. XSS no registro (nome malicioso) =="
$nomeXss = '{"nome":"<script>alert(1)</script>","usuario":"xssprobe50","senha":"segura123"}'
Requisicao 'xss' 'Post' 'api/auth/registro' $nomeXss $null

Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
"servidor finalizado (pid $($p.Id))"
