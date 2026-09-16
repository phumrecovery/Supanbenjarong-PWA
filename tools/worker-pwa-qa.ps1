param(
  [Parameter(Mandatory=$true)][string]$Pin,
  [string]$Gateway='https://suphanbenjarong-api.phum-recovery.workers.dev/api'
)

$ErrorActionPreference='Stop'
$headers=@{Origin='https://phumrecovery.github.io'}
$created=New-Object System.Collections.Generic.List[string]

function Invoke-WorkerApi([string]$Action,$Session,$Data=$null){
  $payload=@{action=$Action}
  if($null -ne $Session){$payload.session=$Session}
  if($null -ne $Data){
    if($Action -eq 'login'){$payload.pin=$Data.pin}else{$payload.data=$Data}
  }
  $reply=Invoke-RestMethod -Method Post -Uri $Gateway -ContentType 'application/json' -Headers $headers -Body ($payload|ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 45
  if(-not $reply.ok){throw ('{0} failed: {1} {2}' -f $Action,$reply.error,$reply.message)}
  return $reply
}

function Assert-Worker([bool]$Condition,[string]$Message){if(-not $Condition){throw ('ASSERT: '+$Message)}}
function Remove-TestJob($Session,[string]$JobId){
  if(-not $JobId){return}
  try{Invoke-WorkerApi 'workerPortalDeletePendingJob' $Session @{jobId=$JobId}|Out-Null}catch{}
  try{Invoke-WorkerApi 'workerPortalDeleteJob' $Session @{jobId=$JobId}|Out-Null}catch{}
}

$report=[ordered]@{}
$session=$null
try {
  $login=Invoke-WorkerApi 'login' $null @{pin=$Pin}
  Assert-Worker ($login.level -eq 'worker') 'PIN did not yield a worker session'
  $session=$login.session
  $initial=Invoke-WorkerApi 'workerPortalBootstrap' $session
  Assert-Worker ([bool]$initial.result.worker) 'bootstrap returned no worker'
  $report.login_and_bootstrap=$true
  Write-Output 'QA: login and bootstrap passed'

  $today=(Get-Date).ToString('yyyy-MM-dd')
  $writer=Invoke-WorkerApi 'workerPortalCreateJob' $session @{role='เขียนลาย';workType='เบญจรงค์';workStyle='เต็มใบ';product='QA-เขียนลาย';pattern='QA-ลาย';qty=2;unit='ชิ้น';priceEach=25;stickerQty=1;receivedDate=$today;note='QA temporary'}
  $writerId=[string]$writer.result.id;$created.Add($writerId)
  Assert-Worker (-not [string]::IsNullOrWhiteSpace($writerId)) 'writer create returned no ID'
  $writerEdit=Invoke-WorkerApi 'workerPortalUpdateJob' $session @{jobId=$writerId;product='QA-เขียนลายแก้ไข';pattern='QA-ลายแก้';qty=3;unit='ชุด';priceEach=30;stickerQty=1;receivedDate=$today;note='QA edited'}
  Assert-Worker ([bool]$writerEdit.result.success) 'writer update failed'
  $writerData=@((Invoke-WorkerApi 'workerPortalBootstrap' $session).result.jobs|Where-Object {$_.id -eq $writerId})[0]
  Assert-Worker (($null -ne $writerData) -and ([int]$writerData.qty -eq 3) -and ([int]$writerData.priceEach -eq 30) -and ($writerData.unit -eq 'ชุด')) 'writer edit was not persisted'
  $writerDelete=Invoke-WorkerApi 'workerPortalDeleteJob' $session @{jobId=$writerId}
  Assert-Worker ([bool]$writerDelete.result.success) 'writer delete failed'
  [void]$created.Remove($writerId)
  $report.writer_create_edit_delete=$true
  Write-Output 'QA: writer create/edit/delete passed'

  $paint=Invoke-WorkerApi 'workerPortalCreateJob' $session @{role='ลงสี';workType='เบญจรงค์';workStyle='เต็มใบ';product='QA-ลงสี';pattern='QA-ลาย';qty=2;unit='ชิ้น';priceEach=28;stickerQty=0;receivedDate=$today;note='QA temporary'}
  $paintId=[string]$paint.result.id;$created.Add($paintId)
  $paintDelete=Invoke-WorkerApi 'workerPortalDeleteJob' $session @{jobId=$paintId}
  Assert-Worker ([bool]$paintDelete.result.success) 'paint delete failed'
  [void]$created.Remove($paintId)

  $gold=Invoke-WorkerApi 'workerPortalCreateJob' $session @{role='วนทอง';workType='วนทอง';workStyle='';product='';pattern='';qty=1;unit='เตา';priceEach=999;stickerQty=0;receivedDate=$today;note='QA temporary'}
  $goldId=[string]$gold.result.id;$created.Add($goldId)
  $goldUpdate=Invoke-WorkerApi 'workerPortalUpdateJob' $session @{jobId=$goldId;qty=2;unit='เตา';priceEach=999;stickerQty=0;receivedDate=$today;note='QA edited'}
  Assert-Worker ([bool]$goldUpdate.result.success) 'gold edit failed'
  $goldData=@((Invoke-WorkerApi 'workerPortalBootstrap' $session).result.jobs|Where-Object {$_.id -eq $goldId})[0]
  Assert-Worker (($null -ne $goldData) -and ([int]$goldData.qty -eq 2) -and ([int]$goldData.priceEach -eq 180)) 'gold quantity or fixed rate failed'
  $goldDelete=Invoke-WorkerApi 'workerPortalDeleteJob' $session @{jobId=$goldId}
  Assert-Worker ([bool]$goldDelete.result.success) 'gold delete failed'
  [void]$created.Remove($goldId)
  $report.role_variants=$true
  Write-Output 'QA: paint and gold variants passed'

  $flow=Invoke-WorkerApi 'workerPortalCreateJob' $session @{role='เขียนลาย';workType='เบญจรงค์';workStyle='เต็มใบ';product='QA-ส่งงาน';pattern='QA-ลาย';qty=3;unit='ชิ้น';priceEach=25;stickerQty=1;receivedDate=$today;note='QA temporary'}
  $flowId=[string]$flow.result.id;$created.Add($flowId)
  $photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5VQAAAABJRU5ErkJggg=='
  $sent=Invoke-WorkerApi 'workerPortalSubmit' $session @{jobId=$flowId;qty=1;photoData=$photo;photoName='qa.png';submittedDate=$today}
  $submissionId=[string]$sent.result.id
  Assert-Worker (-not [string]::IsNullOrWhiteSpace($submissionId)) 'submit returned no ID'
  $pending=Invoke-WorkerApi 'workerPortalBootstrap' $session
  $flowData=@($pending.result.jobs|Where-Object {$_.id -eq $flowId})[0]
  $submission=@($pending.result.submissions|Where-Object {$_.id -eq $submissionId})[0]
  Assert-Worker (($null -ne $flowData) -and ([int]$flowData.pendingQty -eq 1) -and ($submission.status -eq 'รอตรวจ') -and (-not [string]::IsNullOrWhiteSpace([string]$submission.photoUrl))) 'submit or photo persistence failed'
  $pendingSave=Invoke-WorkerApi 'workerPortalUpdatePendingSubmission' $session @{submissionId=$submissionId;qty=2;priceEach=35;jobQty=3;photoData='';photoName=''}
  Assert-Worker ([bool]$pendingSave.result.success) 'pending update failed'
  $pendingUpdated=Invoke-WorkerApi 'workerPortalBootstrap' $session
  $flowUpdated=@($pendingUpdated.result.jobs|Where-Object {$_.id -eq $flowId})[0]
  $submissionUpdated=@($pendingUpdated.result.submissions|Where-Object {$_.id -eq $submissionId})[0]
  Assert-Worker (($null -ne $flowUpdated) -and ([int]$flowUpdated.pendingQty -eq 2) -and ([int]$flowUpdated.priceEach -eq 35) -and ([int]$submissionUpdated.qty -eq 2)) 'pending update was not persisted'
  $pendingDelete=Invoke-WorkerApi 'workerPortalDeletePendingJob' $session @{jobId=$flowId}
  Assert-Worker ([bool]$pendingDelete.result.success) 'pending withdrawal failed'
  [void]$created.Remove($flowId)
  $final=Invoke-WorkerApi 'workerPortalBootstrap' $session
  Assert-Worker (@($final.result.jobs|Where-Object {$_.product -like 'QA-*'}).Count -eq 0) 'QA jobs remained after cleanup'
  Assert-Worker (@($final.result.submissions|Where-Object {$_.id -eq $submissionId}).Count -eq 0) 'QA submission remained after cleanup'
  $report.submit_edit_withdraw_and_cleanup=$true
  Write-Output 'QA: submit/photo/pending-edit/withdraw passed'
  [PSCustomObject]$report|ConvertTo-Json -Compress
} catch {
  Write-Output ('QA FAILED: '+$_.Exception.Message)
  throw
} finally {
  for($i=$created.Count-1;$i -ge 0;$i--){Remove-TestJob $session $created[$i]}
}

