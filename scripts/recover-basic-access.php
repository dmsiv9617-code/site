<?php
// Manual operator tool. Never serve a password-recovery endpoint or log credentials.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
function wb_basic_write($handle,$contents){
 if(!rewind($handle))throw new RuntimeException('Не удалось подготовить запись.');
 $offset=0;$length=strlen($contents);
 while($offset<$length){$n=fwrite($handle,substr($contents,$offset));if($n===false||$n===0)throw new RuntimeException('Не удалось записать файл.');$offset+=$n;}
 if(!ftruncate($handle,$length)||!fflush($handle))throw new RuntimeException('Не удалось сохранить файл.');
 if(function_exists('fsync')&&!fsync($handle))throw new RuntimeException('Не удалось синхронизировать файл.');
}
function wb_basic_reset($path,$backup,$username,$password){
 if(!is_string($password)||strlen($password)<16||strlen($password)>72||str_contains($password,"\0"))throw new RuntimeException('Пароль должен содержать от 16 до 72 байт, без нулевых символов. Используйте 20–30 латинских букв, цифр и знаков.');
 if(!preg_match('/^[A-Za-z0-9_-]+$/D',$username))throw new RuntimeException('Некорректный логин.');
 foreach([$path,$backup] as $file)if(!is_file($file)||is_link($file)||!is_readable($file))throw new RuntimeException('Файл защиты или резервная копия недоступны. Ничего не изменено.');
 if(realpath($path)===realpath($backup))throw new RuntimeException('Резервная копия должна быть отдельным файлом.');
 $handle=fopen($path,'r+');if(!$handle)throw new RuntimeException('Нет доступа к записи файла защиты.');
 $locked=false;
 try{
  if(!flock($handle,LOCK_EX))throw new RuntimeException('Не удалось заблокировать файл.');$locked=true;
  $original=stream_get_contents($handle);$copy=file_get_contents($backup);
  if(!is_string($original)||!is_string($copy)||$original===''||!hash_equals($original,$copy))throw new RuntimeException('Файл изменился после резервного копирования. Ничего не изменено.');
  $hash=password_hash($password,PASSWORD_BCRYPT);
  if(!is_string($hash)||!password_verify($password,$hash))throw new RuntimeException('Не удалось подготовить новый пароль.');
  $count=0;$changed=preg_replace_callback('/^'.preg_quote($username,'/').':[^\r\n]*/m',fn()=>$username.':'.$hash,$original,-1,$count);
  if($count!==1||!is_string($changed))throw new RuntimeException('Нужна ровно одна запись указанного пользователя. Ничего не изменено.');
  try{
   // Preserve the mounted inode: renaming a host file would leave Nginx bound to the old one.
   wb_basic_write($handle,$changed);rewind($handle);
   if(stream_get_contents($handle)!==$changed)throw new RuntimeException('Проверка записи не прошла.');
  }catch(Throwable $error){
   try{wb_basic_write($handle,$original);}catch(Throwable $restoreError){throw new RuntimeException('Ошибка записи и восстановления. Требуется ручное восстановление из резервной копии.');}
   throw new RuntimeException('Ошибка записи. Исходный файл восстановлен.');
  }
 }finally{if($locked)flock($handle,LOCK_UN);fclose($handle);}
}
function wb_basic_password_prompt(){
 if(!function_exists('exec')||!function_exists('stream_isatty')||!stream_isatty(STDIN))throw new RuntimeException('Нужна интерактивная консоль с TTY.');
 $output=[];$status=1;exec('stty -g 2>/dev/null',$output,$status);$state=trim(implode('',$output));
 if($status!==0||$state==='')throw new RuntimeException('Нельзя гарантировать скрытый ввод. Операция остановлена.');
 $active=false;
 $restore=function()use($state,&$active){if($active){$ignored=[];$code=0;exec('stty '.escapeshellarg($state).' 2>/dev/null',$ignored,$code);$active=false;}};
 register_shutdown_function($restore);
 if(function_exists('pcntl_async_signals')&&function_exists('pcntl_signal')){pcntl_async_signals(true);foreach([SIGINT,SIGTERM] as $signal)pcntl_signal($signal,function()use($restore){$restore();exit(130);});}
 $ignored=[];exec('stty -echo 2>/dev/null',$ignored,$status);
 if($status!==0)throw new RuntimeException('Не удалось скрыть ввод. Операция остановлена.');$active=true;
 try{
  fwrite(STDOUT,'New password (hidden): ');$first=fgets(STDIN);
  fwrite(STDOUT,"\nRepeat password (hidden): ");$second=fgets(STDIN);fwrite(STDOUT,"\n");
  if($first===false||$second===false)throw new RuntimeException('Ввод прерван. Ничего не изменено.');
  $first=rtrim($first,"\r\n");$second=rtrim($second,"\r\n");
  if(!hash_equals($first,$second))throw new RuntimeException('Пароли не совпали. Ничего не изменено.');
  return $first;
 }finally{$restore();}
}
if(defined('WB_BASIC_ACCESS_LIBRARY'))return;
try{
 if(count($argv)!==2||$argv[1]==='')throw new RuntimeException('Укажите путь к проверенной резервной копии.');
 $path='/auth/staging.htpasswd';$backup=$argv[1];
 if(!is_file($path)||!is_file($backup)||is_link($path)||is_link($backup)||file_get_contents($path)!==file_get_contents($backup))throw new RuntimeException('Проверьте подключение файла защиты и путь к его резервной копии.');
 fwrite(STDOUT,"Будет изменён пароль только для woodbase-reviewer. Защита останется включённой.\n");
 $password=wb_basic_password_prompt();wb_basic_reset($path,$backup,'woodbase-reviewer',$password);unset($password);
 fwrite(STDOUT,"Пароль для woodbase-reviewer обновлён. Введите новый пароль в окне браузера.\n");
}catch(Throwable $error){fwrite(STDERR,$error->getMessage()."\n");exit(1);}
