const nav=document.getElementById('nav');
const menuBtn=document.getElementById('menu-btn');
const mobileMenu=document.getElementById('mobile-menu');
function hs(){nav.classList.toggle('scrolled',window.scrollY>60);nav.classList.toggle('transparent',window.scrollY<=60);}
window.addEventListener('scroll',hs,{passive:true});
if(menuBtn&&mobileMenu){
  menuBtn.addEventListener('click',function(e){e.stopPropagation();mobileMenu.classList.toggle('open');});
  document.addEventListener('click',function(e){if(!nav.contains(e.target)&&!mobileMenu.contains(e.target)){mobileMenu.classList.remove('open');}});
}
const obs=new IntersectionObserver(e=>{e.forEach(el=>{if(el.isIntersecting){el.target.classList.add('visible');obs.unobserve(el.target);}});},{threshold:.1});
document.querySelectorAll('.fade-in').forEach(el=>obs.observe(el));
document.querySelectorAll('.hero-page .fade-in').forEach(el=>setTimeout(()=>el.classList.add('visible'),80));

/* Menu mobile : un seul volet ouvert a la fois */
var mmBtns=document.querySelectorAll('.mobile-menu button.mobile-section-title');
mmBtns.forEach(function(btn){
  btn.addEventListener('click',function(){
    var panel=document.getElementById(btn.getAttribute('aria-controls'));
    var open=btn.getAttribute('aria-expanded')==='true';
    mmBtns.forEach(function(other){
      if(other!==btn){
        other.setAttribute('aria-expanded','false');
        var p=document.getElementById(other.getAttribute('aria-controls'));
        if(p){p.hidden=true;}
      }
    });
    btn.setAttribute('aria-expanded',open?'false':'true');
    if(panel){panel.hidden=open;}
  });
});
