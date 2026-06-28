(function(){
  var form=document.getElementById('contact-form');
  var btn=document.getElementById('form-submit-btn');
  var success=document.getElementById('form-success');
  if(!form)return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    btn.disabled=true;
    btn.querySelector('.btn-text').textContent='Bezig met verzenden…';
    var data=new FormData(form);
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data).toString()})
    .then(function(r){
      if(r.ok){form.style.display='none';success.style.display='block';window.scrollTo({top:success.getBoundingClientRect().top+window.scrollY-120,behavior:'smooth'});}
      else{btn.disabled=false;btn.querySelector('.btn-text').textContent='Bericht verzenden';alert('Er is een fout opgetreden. Probeer het opnieuw.');}
    })
    .catch(function(){btn.disabled=false;btn.querySelector('.btn-text').textContent='Bericht verzenden';alert('Er is een fout opgetreden. Probeer het opnieuw.');});
  });
})();
