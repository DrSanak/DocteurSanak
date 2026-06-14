const nav=document.getElementById('nav');
const menuBtn=document.getElementById('menu-btn');
const mobileMenu=document.getElementById('mobile-menu');
function hs(){nav.classList.toggle('scrolled',window.scrollY>60);nav.classList.toggle('transparent',window.scrollY<=60);}
window.addEventListener('scroll',hs,{passive:true});
if(menuBtn&&mobileMenu){menuBtn.addEventListener('click',function(e){e.stopPropagation();mobileMenu.classList.toggle('open');});document.addEventListener('click',function(e){if(!nav.contains(e.target)&&!mobileMenu.contains(e.target)){mobileMenu.classList.remove('open');}});}
const obs=new IntersectionObserver(e=>{e.forEach(el=>{if(el.isIntersecting){el.target.classList.add('visible');obs.unobserve(el.target);}});},{threshold:.1});
document.querySelectorAll('.fade-in').forEach(el=>obs.observe(el));
document.querySelectorAll('.hero-page .fade-in').forEach(el=>setTimeout(()=>el.classList.add('visible'),80));