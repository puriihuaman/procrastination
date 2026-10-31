import "./style.css";
import javascriptLogo from "./assets/javascript.svg";


document.querySelector("#app").innerHTML = `
<section id="center">
  <div class="hero">
    <img src="${javascriptLogo}" class="framework" alt="JavaScript logo"/>
  </div>
  <div>
    <h1>Sistema Supera la Procrastinación</h1>
  </div>
</section>

<div class="ticks"></div>

<footer id="next-steps">
  
  <div id="social">
    <div>
      <svg class="icon" role="presentation" aria-hidden="true">
        <use href="/icons.svg#social-icon"></use>
      </svg>
      <h2>Conecta con nosotros</h2>
    </div>
    
    <ul>
      <li>
        <a href="https://github.com/puriihuaman" target="_blank">
          <svg class="button-icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#github-icon"></use>
          </svg>
          puriihuaman
        </a>
      </li>
      
      <li>
        <a href="https://github.com/puriihuaman" target="_blank">
          <svg class="button-icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#github-icon"></use>
          </svg>
          GitHub
        </a>
      </li>
      
      <li>
        <a href="https://github.com/puriihuaman" target="_blank">
          <svg class="button-icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#github-icon"></use>
          </svg>
          GitHub
        </a>
      </li>
    </ul>
  </div>
</footer>
`;

