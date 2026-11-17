
const SUPABASE_URL = "https://hsdyjmwawtajweqfrtlx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1kbMMLlBk2QR4JzwgTo2Zw_WIkQxkjg";

const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let member = null;
let notificationTimer = null;

const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmtDate=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('fr-FR');};

async function ensureSession(){const {data:{session}}=await db.auth.getSession();if(session)return true;const {error}=await db.auth.signInAnonymously();if(error)throw error;return true;}


let loginInProgress = false;
let sessionPromise = null;

async function ensureSessionSafe(){

  // Si une session existe déjà, on la conserve
  const { data, error } = await db.auth.getSession();

  if(error) throw error;

  if(data?.session){
    return data.session;
  }

  // Empêche plusieurs créations de sessions simultanées
  if(sessionPromise){
    return await sessionPromise;
  }

  sessionPromise = (async()=>{

    const { data, error } = await db.auth.signInAnonymously();

    if(error) throw error;

    if(!data?.session){
      throw new Error('Impossible de créer la session Supabase.');
    }

    return data.session;

  })();

  try{
    return await sessionPromise;
  }finally{
    sessionPromise = null;
  }
}


async function login(){

  // Empêche deux appels simultanés à login()
  if(loginInProgress){
    console.log('Connexion déjà en cours...');
    return;
  }

  loginInProgress = true;

  const loginError = $('loginError');
  const loginBtn = $('loginBtn');
  const accessCode = $('accessCode');



  if(loginError){
    loginError.textContent = '';
  }

  const code = accessCode?.value.trim().toUpperCase() || '';

  if(!code){

    if(loginError){
      loginError.textContent = 'Saisissez votre code.';
    }

    loginInProgress = false;
    return;
  }

  if(loginBtn){

    loginBtn.disabled = true;
    loginBtn.textContent = 'Connexion…';

  }

  try{

    // Récupère ou crée UNE SEULE session
    const session = await ensureSessionSafe();

    console.log(
      'SESSION SUPABASE =',
      session?.user?.id
    );

    // Connexion par code
    const { data, error } = await db.rpc(
      'login_with_code',
      {
        p_access_code: code
      }
    );

    console.log('RPC COMPLET =', data);

    if(error){

      console.error('ERREUR RPC LOGIN =', error);

      throw new Error(
        error.message || 'Erreur lors de la connexion.'
      );
    }

    if(!data?.success){

      throw new Error(
        data?.message || 'Code incorrect.'
      );
    }

    if(!data.member){

      throw new Error(
        'Impossible de récupérer les informations du membre.'
      );
    }

  // Membre connecté
member = data.member;

console.log(
  'MEMBRE CONNECTÉ =',
  member
);


    
/* =====================================================
   🚧 VÉRIFICATION MODE MAINTENANCE
   ===================================================== */

const maintenanceActive =
  await checkMaintenanceMode();


/*
  Si l'utilisateur n'est pas administrateur
  et que la maintenance est active,
  on arrête ici.

  Aucun mail.
  Aucune notification.
  Aucun push.
*/

if(maintenanceActive){

  return;

}


/* =====================================================
   APPLICATION NORMALE
   ===================================================== */

// Affichage
$('loginView')?.classList.add('hidden');
$('mainView')?.classList.remove('hidden');
setTimeout(() => {
  showInstallAppPrompt();
}, 1000);

    
    const badge = $('memberBadge');

    if(badge){

      const nom =
        `${member.first_name || ''} ${member.last_name || ''}`.trim();

      const fonction =
        member.role === 'admin'
          ? 'Administrateur'
          : 'Membre';

      badge.textContent =
        `${nom} · ${fonction}`;
    }

renderHome();

registerMemberPhoneNotifications();


  
  }catch(error){

    console.error(
      'ERREUR CONNEXION :',
      error
    );

    if(loginError){

      loginError.textContent =
        error?.message ||
        'Connexion impossible.';

    }

  }finally{

    loginInProgress = false;

    if(loginBtn){

      loginBtn.disabled = false;
      loginBtn.textContent = 'Se connecter';

    }

  }
}

// =====================================================
// BOUTON CONNEXION
// =====================================================

const loginButton = $('loginBtn');

if(loginButton && !loginButton.dataset.loginBound){

  loginButton.dataset.loginBound = '1';

  loginButton.addEventListener(
    'click',
    login
  );

}

// =====================================================
// INSTALLATION PWA
// =====================================================

let deferredInstallPrompt = null;


// =====================================================
// Récupération de la demande d'installation Android
// =====================================================

window.addEventListener(
  'beforeinstallprompt',
  event => {

    console.log(
      '📱 Application installable détectée.'
    );

    event.preventDefault();

    deferredInstallPrompt = event;

    // Afficher la proposition dès que Chrome
    // nous indique que l'application est installable
    setTimeout(() => {

      showInstallAppPrompt();

    }, 500);

  }
);

// =====================================================
// Vérifier si l'application est déjà installée
// =====================================================

function isAppInstalled(){

  return (
    window.matchMedia &&
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches
  ) || window.navigator.standalone === true;

}


// =====================================================
// Afficher la proposition d'installation
// =====================================================

function showInstallAppPrompt(){

  const box =
    document.getElementById(
      'installAppBox'
    );

  if(!box){
    return;
  }


  // Déjà installée
  if(isAppInstalled()){

    console.log(
      '📱 Application déjà installée.'
    );

    box.classList.add('hidden');

    return;

  }


  // L'utilisateur a déjà choisi "Plus tard"
  if(
    localStorage.getItem(
      'installAppLater'
    ) === 'true'
  ){

    return;

  }


  // Android / Chrome
  if(deferredInstallPrompt){

    box.classList.remove('hidden');

    return;

  }


  // iPhone / iPad
  const isIOS =
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    );


  if(isIOS){

    showIOSInstallInstructions();

  }

}


// =====================================================
// Installation Android
// =====================================================

async function installApp(){

  if(!deferredInstallPrompt){

    return;

  }


  const promptEvent =
    deferredInstallPrompt;


  deferredInstallPrompt = null;


  try{

    await promptEvent.prompt();

    const result =
      await promptEvent.userChoice;


    console.log(
      '📱 Résultat installation :',
      result.outcome
    );


    if(
      result.outcome === 'accepted'
    ){

      localStorage.setItem(
        'installAppDone',
        'true'
      );

    }

  }catch(error){

    console.error(
      '❌ Erreur installation PWA :',
      error
    );

  }


  hideInstallAppPrompt();

}


// =====================================================
// Fermer la proposition
// =====================================================

function hideInstallAppPrompt(){

  const box =
    document.getElementById(
      'installAppBox'
    );

  if(box){

    box.classList.add('hidden');

  }

}


// =====================================================
// Plus tard
// =====================================================

function installAppLater(){

  localStorage.setItem(
    'installAppLater',
    'true'
  );


  hideInstallAppPrompt();

}


// =====================================================
// Instructions iPhone / iPad
// =====================================================

function showIOSInstallInstructions(){

  const box =
    document.getElementById(
      'installAppBox'
    );

  if(!box){
    return;
  }


  const text =
    box.querySelector(
      '.install-app-text'
    );


  if(text){

    text.innerHTML = `

      <strong>
        Installer l'application
      </strong>

      <span>
        Sur votre iPhone, appuyez sur
        <strong>Partager</strong>,
        puis sur
        <strong>Sur l'écran d'accueil</strong>.
      </span>

    `;

  }


  const installButton =
    document.getElementById(
      'installAppBtn'
    );


  if(installButton){

    installButton.style.display =
      'none';

  }


  box.classList.remove('hidden');

}


// =====================================================
// Boutons
// =====================================================

document.addEventListener(
  'DOMContentLoaded',
  () => {

    const installButton =
      document.getElementById(
        'installAppBtn'
      );


    const laterButton =
      document.getElementById(
        'installLaterBtn'
      );


    if(installButton){

      installButton.addEventListener(
        'click',
        installApp
      );

    }


    if(laterButton){

      laterButton.addEventListener(
        'click',
        installAppLater
      );

    }

  }
);


// =====================================================
// Exposer les fonctions
// =====================================================

window.showInstallAppPrompt =
  showInstallAppPrompt;

window.installApp =
  installApp;

window.installAppLater =
  installAppLater;

async function registerMemberPhoneNotifications(){

  try{

    // =====================================================
    // 1. Vérifications navigateur
    // =====================================================

    if(
      !window.isSecureContext ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ){

      console.log(
        '📱 Notifications Push non disponibles sur cet appareil.'
      );

      return false;
    }


    // =====================================================
    // 2. Vérifier le membre connecté
    // =====================================================

    if(!member || !member.id){

      console.log(
        '📱 Aucun membre connecté.'
      );

      return false;
    }


    // =====================================================
    // 3. Vérifier la session Supabase
    // =====================================================

    const {
      data: {
        session
      },
      error: sessionError
    } = await db.auth.getSession();


    if(sessionError){

      console.error(
        '❌ Erreur session Supabase :',
        sessionError
      );

      return false;
    }


    if(
      !session ||
      !session.user ||
      !session.user.id
    ){

      console.error(
        '❌ Aucune session Supabase valide.'
      );

      return false;
    }


    // =====================================================
    // 4. Service Worker
    // =====================================================

    const registration =
      await navigator.serviceWorker.register(
        '/sw.js'
      );


    await navigator.serviceWorker.ready;


    // =====================================================
    // 5. Autorisation notifications
    // =====================================================

    let permission =
      Notification.permission;


    if(permission === 'default'){

      permission =
        await Notification.requestPermission();

    }


    if(permission !== 'granted'){

      console.log(
        '📱 Autorisation des notifications refusée.'
      );

      return false;
    }


    // =====================================================
    // 6. Clé VAPID
    // =====================================================

    const VAPID_PUBLIC_KEY =
      'BKV5be3L_jdNVAL3pJkxUZubvrbjAM-ZRb4puEMw-oIDA2HsfkvWpviUNeMpuJpln7DHwIunuafdlbnzWWelMuA';


    // =====================================================
    // 7. Conversion clé VAPID
    // =====================================================

    function base64ToUint8Array(base64String){

      const padding =
        '='.repeat(
          (4 - base64String.length % 4) % 4
        );


      const base64 =
        (base64String + padding)
          .replace(/-/g, '+')
          .replace(/_/g, '/');


      const rawData =
        window.atob(base64);


      const outputArray =
        new Uint8Array(
          rawData.length
        );


      for(
        let i = 0;
        i < rawData.length;
        i++
      ){

        outputArray[i] =
          rawData.charCodeAt(i);

      }


      return outputArray;

    }


    // =====================================================
    // 8. Récupérer l'abonnement Push existant
    // =====================================================

    let subscription =
      await registration.pushManager.getSubscription();


    // =====================================================
    // 9. Créer un abonnement uniquement si nécessaire
    // =====================================================

    if(subscription){

      console.log(
        '📱 Abonnement Push existant conservé.'
      );

    }else{

      console.log(
        '📱 Aucun abonnement Push existant.'
      );


      subscription =
        await registration.pushManager.subscribe({

          userVisibleOnly: true,

          applicationServerKey:
            base64ToUint8Array(
              VAPID_PUBLIC_KEY
            )

        });


      if(!subscription){

        throw new Error(
          'Impossible de créer le nouvel abonnement Push.'
        );

      }


      console.log(
        '✅ Nouvel abonnement Push créé.'
      );

    }


    // =====================================================
    // 10. Préparer les données
    // =====================================================

    const subscriptionJSON =
      subscription.toJSON();


    if(!subscription.endpoint){

      throw new Error(
        'L’abonnement Push ne possède aucun endpoint.'
      );

    }


    // =====================================================
    // 11. Enregistrer dans Supabase
    // =====================================================

    const {
      error: insertError
    } = await db
      .from('push_subscriptions')
      .insert({

        member_id:
          member.id,

        endpoint:
          subscription.endpoint,

        subscription:
          subscriptionJSON,

        updated_at:
          new Date().toISOString()

      });


    // =====================================================
    // 12. Gestion de l'enregistrement
    // =====================================================

    if(insertError){

      // -----------------------------------------------
      // L'endpoint existe déjà
      // -----------------------------------------------

      if(
        insertError.code === '23505' ||
        String(insertError.message || '')
          .includes(
            'push_subscriptions_endpoint_key'
          )
      ){

        console.log(
          '📱 Cet abonnement Push existe déjà.'
        );

      }else{

        console.error(
          '❌ Erreur enregistrement Push :',
          insertError
        );

        throw new Error(
          insertError.message
        );

      }

    }


    // =====================================================
    // 13. Succès
    // =====================================================

    console.log(
      '🎉 Notifications Push prêtes.',
      member.id
    );


    return true;


  }catch(error){

    console.error(
      '❌ ERREUR NOTIFICATIONS PUSH :',
      error
    );


    alert(
      '❌ Impossible d’enregistrer les notifications.\n\n' +
      (
        error?.message ||
        'Erreur inconnue'
      )
    );


    return false;

  }

}


window.registerMemberPhoneNotifications =
  registerMemberPhoneNotifications;


function logout() {

  console.log('🔴 BOUTON DÉCONNEXION CLIQUÉ');

  // Garder la session Supabase
  // NE PAS faire db.auth.signOut()

  member = null;

  // Masquer l'application
  const mainView = document.getElementById('mainView');

  if (mainView) {
    mainView.classList.add('hidden');
  }

  // Afficher l'écran de connexion
  const loginView = document.getElementById('loginView');

  if (loginView) {
    loginView.classList.remove('hidden');
  }

  // Vider le code d'accès
  const accessCode = document.getElementById('accessCode');

  if (accessCode) {
    accessCode.value = '';
    accessCode.focus();
  }

  // Effacer le message d'erreur
  const loginError = document.getElementById('loginError');

  if (loginError) {
    loginError.textContent = '';
  }

  console.log(
    '✅ Déconnexion locale effectuée. Session Supabase conservée.'
  );
}


// IMPORTANT : rendre la fonction accessible
// aux boutons onclick="logout()"
window.logout = logout;
// Brancher le bouton Déconnexion
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', logout);
  console.log('✅ Bouton Déconnexion correctement relié à logout()');
}

/* =========================================================
   🚧 VÉRIFICATION DU MODE MAINTENANCE
   ========================================================= */

async function checkMaintenanceMode(){

  try{

    const {
      data,
      error
    } = await db
      .from('system_settings')
      .select(
        'maintenance_mode,maintenance_message'
      )
      .eq('id','global')
      .single();


    if(error){

      console.error(
        'ERREUR VÉRIFICATION MAINTENANCE :',
        error
      );

      // En cas d'erreur, on laisse l'application fonctionner
      return false;

    }


    /*
      Les administrateurs peuvent toujours accéder
      à l'application pendant la maintenance.
    */

    if(member?.role === 'admin'){

      return false;

    }


    if(data?.maintenance_mode === true){

      const message =
        data.maintenance_message ||
        'L’application est actuellement en maintenance. Merci de revenir ultérieurement.';


      /*
        On masque l'application.
      */

      $('loginView')?.classList.add('hidden');
      $('mainView')?.classList.add('hidden');


      /*
        Création de la page maintenance.
      */

      let maintenanceView =
        document.getElementById(
          'maintenanceView'
        );


      if(!maintenanceView){

        maintenanceView =
          document.createElement('div');

        maintenanceView.id =
          'maintenanceView';

        maintenanceView.style.cssText = `
          position:fixed;
          inset:0;
          z-index:99999;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:25px;
          background:#f8fafc;
          text-align:center;
        `;


        maintenanceView.innerHTML = `

          <div
            class="card"
            style="
              max-width:500px;
              width:100%;
              margin:auto;
              padding:35px 25px;
            "
          >

            <div
              style="
                font-size:60px;
                margin-bottom:15px;
              "
            >
              🚧
            </div>


            <h1
              style="
                margin:0 0 12px;
              "
            >
              Application en maintenance
            </h1>


            <p
              class="muted"
              style="
                font-size:16px;
                line-height:1.6;
                margin:0;
              "
            >
              ${esc(message)}
            </p>


            <div
              style="
                margin-top:25px;
                padding:12px;
                border-radius:10px;
                background:#f1f5f9;
              "
            >

              🛠️ Maintenance en cours

            </div>

          </div>

        `;


        document.body.appendChild(
          maintenanceView
        );

      }


      maintenanceView.style.display =
        'flex';


      return true;

    }


    return false;


  }catch(error){

    console.error(
      'ERREUR MODE MAINTENANCE :',
      error
    );

    return false;

  }

}


async function changeMyCode(){

  if(!member?.id){

    alert('Vous devez être connecté.');

    return;
  }

  openModal(`

    <h2>🔑 Modifier mon code d'accès</h2>

    <div class="field">

      <label>Ancien code</label>

      <input
        id="oldMyCode"
        class="input"
        type="password"
        autocomplete="current-password"
        placeholder="Votre code actuel">

    </div>

    <div class="field">

      <label>Nouveau code</label>

      <input
        id="newMyCode"
        class="input"
        type="password"
        autocomplete="new-password"
        placeholder="Nouveau code">

    </div>

    <div class="field">

      <label>Confirmer le nouveau code</label>

      <input
        id="confirmMyCode"
        class="input"
        type="password"
        autocomplete="new-password"
        placeholder="Confirmer le nouveau code">

    </div>

    <div
      class="row"
      style="margin-top:15px;gap:8px;">

      <button
        type="button"
        class="primary"
        onclick="saveMyCode()">

        💾 Enregistrer

      </button>

      <button
        type="button"
        class="ghost"
        onclick="closeModal()">

        Annuler

      </button>

    </div>

  `);
}


async function saveMyCode(){

  try{

    if(!member?.id){

      alert('Vous devez être connecté.');

      return;
    }

    const oldCode =
      $('oldMyCode')?.value.trim().toUpperCase() || '';

    const newCode =
      $('newMyCode')?.value.trim().toUpperCase() || '';

    const confirmCode =
      $('confirmMyCode')?.value.trim().toUpperCase() || '';

    if(!oldCode || !newCode || !confirmCode){

      alert(
        'Veuillez remplir tous les champs.'
      );

      return;
    }

    if(newCode !== confirmCode){

      alert(
        'Les deux nouveaux codes ne correspondent pas.'
      );

      return;
    }

    if(newCode === oldCode){

      alert(
        'Le nouveau code doit être différent de l’ancien.'
      );

      return;
    }

    const { data, error } = await db.rpc(
      'change_my_code',
      {
        p_old_code: oldCode,
        p_new_code: newCode
      }
    );

    console.log(
      'RESULTAT CHANGE CODE =',
      data
    );

    if(error){

      console.error(
        'ERREUR RPC CHANGE CODE =',
        error
      );

      throw new Error(
        error.message ||
        'Erreur lors de la modification du code.'
      );
    }

    if(!data?.success){

      alert(
        '❌ ' +
        (
          data?.message ||
          'Impossible de modifier le code.'
        )
      );

      return;
    }

    // Mise à jour locale
    member.access_code = newCode;

    closeModal();

    alert(
      '✅ Votre code d’accès a été modifié avec succès.'
    );

  }catch(error){

    console.error(
      'ERREUR MODIFICATION CODE =',
      error
    );

    alert(
      error?.message ||
      'Impossible de modifier votre code.'
    );
  }
}

// ==========================================================
// 📨 MESSAGES DE L'ADMINISTRATEUR - UTILISATEUR
// ==========================================================

async function showUserMessages(){

  if(!member?.id){

    alert(
      'Vous devez être connecté.'
    );

    return;

  }


  try{

    const {data:notes,error} =
      await db

        .from('admin_notes')

        .select(
          'id,title,content,created_at,recipient_type,recipient_member_id'
        )

        .eq(
          'active',
          true
        )

        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(error){

      console.error(
        'ERREUR CHARGEMENT MESSAGES :',
        error
      );

      alert(
        'Impossible de charger les messages.'
      );

      return;

    }


    // =====================================================
    // 🎯 FILTRAGE DES DESTINATAIRES
    // =====================================================

    const messages =
      (notes || []).filter(note => {

        // 📢 MESSAGE À TOUS
        if(
          !note.recipient_type ||
          note.recipient_type === 'all'
        ){

          return true;

        }


        // 🏛️ MESSAGE AUX MEMBRES DU BUREAU
        if(
          note.recipient_type === 'bureau'
        ){

          return (
            member.bureau_member === true
          );

        }


        // 👤 MESSAGE À UN MEMBRE PRÉCIS
        if(
          note.recipient_type === 'member'
        ){

          return (
            note.recipient_member_id ===
            member.id
          );

        }


        // Si le type est inconnu,
        // on ne l'affiche pas.
        return false;

      });


    // =====================================================
    // 📨 AFFICHAGE DES MESSAGES
    // =====================================================

    openModal(`

      <h2>
        📨 Messages de l'administrateur
      </h2>


      ${
        messages.length

          ? `

            <div>

              ${messages.map(note => `

                <div
                  class="card"
                  onclick="openUserMessage('${note.id}')"
                  style="
                    margin-bottom:12px;
                    cursor:pointer;
                  "
                >

                  <h3>
                    📝
                    ${esc(
                      note.title ||
                      'Message de l’administrateur'
                    )}
                  </h3>


                  ${
                    note.recipient_type === 'bureau'

                      ? `

                        <div
                          style="
                            margin-top:6px;
                            font-size:13px;
                            opacity:0.75;
                          "
                        >

                          🏛️ Message au bureau

                        </div>

                      `

                      : note.recipient_type === 'member'

                        ? `

                          <div
                            style="
                              margin-top:6px;
                              font-size:13px;
                              opacity:0.75;
                            "
                          >

                            👤 Message personnel

                          </div>

                        `

                        : `

                          <div
                            style="
                              margin-top:6px;
                              font-size:13px;
                              opacity:0.75;
                            "
                          >

                            📢 Message à tous les membres

                          </div>

                        `
                  }


                  ${
                    note.created_at

                      ? `

                        <small
                          class="muted"
                        >

                          📅
                          ${new Date(
                            note.created_at
                          ).toLocaleDateString(
                            'fr-FR'
                          )}

                        </small>

                      `

                      : ''
                  }


                  <div
                    style="
                      margin-top:8px;
                      font-size:13px;
                      opacity:0.7;
                    "
                  >

                    👆 Cliquer pour ouvrir

                  </div>

                </div>

              `).join('')}

            </div>

          `

          : `

            <div class="card">

              <p>
                📭 Aucun message.
              </p>

            </div>

          `
      }


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >
<button
  type="button"
  class="secondary"
  onclick="newMemberMessage()"
>
  ✉️ Contacter le Bureau Amicale
</button>

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >

          Fermer

        </button>
<button
  type="button"
  class="secondary"
  onclick="showMemberMessaging()"
>
  ✉️ Messagerie avec le Bureau
</button>
      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR MESSAGES UTILISATEUR :',
      error
    );

    alert(
      'Impossible de charger les messages.'
    );

  }

}

function newMemberMessage(){

  openModal(`

    <h2>
      ✉️ Contacter le Bureau Amicale
    </h2>


    <div class="field">

      <label>
        Objet
      </label>

      <input
        id="memberMessageSubject"
        class="input"
        placeholder="Objet du message"
      >

    </div>


    <div class="field">

      <label>
        Message
      </label>

      <textarea
        id="memberMessageContent"
        class="textarea"
        placeholder="Votre message..."
      ></textarea>

    </div>


    <div
      class="row"
      style="
        margin-top:15px;
      "
    >

      <button
        class="primary"
        onclick="sendMemberMessage()"
      >

        📤 Envoyer

      </button>


      <button
        class="ghost"
        onclick="closeModal()"
      >

        Annuler

      </button>

    </div>

  `);

}


window.newMemberMessage =
  newMemberMessage;
async function sendMemberMessage(){

  if(!member?.id){

    alert('Vous devez être connecté.');

    return;

  }


  const subject =
    $('memberMessageSubject')?.value.trim() || '';

  const content =
    $('memberMessageContent')?.value.trim() || '';


  if(!subject){

    alert('Veuillez renseigner l’objet du message.');

    return;

  }


  if(!content){

    alert('Veuillez écrire votre message.');

    return;

  }


  try{

    // =====================================================
    // 👔 RÉCUPÉRER LE COMPTE ADMIN
    // =====================================================

    const {data:admins,error:adminError} =
      await db
        .from('members')
        .select('id')
        .eq('role','admin');


    if(adminError)
      throw adminError;


    if(!admins || !admins.length){

      alert(
        'Impossible de trouver le compte du Bureau Amicale.'
      );

      return;

    }


    const adminId =
      admins[0].id;


    // =====================================================
    // 📤 ENVOYER LE MESSAGE
    // =====================================================

    const {error} =
      await db
        .from('member_messages')
        .insert({

          sender_id:member.id,

          receiver_id:adminId,

          parent_id:null,

          subject,

          content,

          read_at:null,

          answered:false,

          active:true

        });


    if(error)
      throw error;
if(error)
  throw error;

sendAdminEmailNotification(
  'message',
  '💬 Nouveau message',
  `Objet : ${subject}

${content}`,
  `${member.first_name || ''} ${member.last_name || ''}`.trim()
);

closeModal();

    closeModal();


    alert(
      '✅ Votre message a été envoyé au Bureau Amicale.'
    );


  }catch(error){

    console.error(
      'ERREUR ENVOI MESSAGE BUREAU :',
      error
    );


    alert(
      error.message ||
      'Impossible d’envoyer le message.'
    );

  }

}


window.sendMemberMessage =
  sendMemberMessage;

async function showMemberMessaging(){

  if(!member?.id){

    alert('Vous devez être connecté.');

    return;

  }

  try{

    const {data:messages,error} =
      await db
        .from('member_messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          subject,
          content,
          created_at,
          read_at,
          parent_id
        `)
        .or(
          `sender_id.eq.${member.id},receiver_id.eq.${member.id}`
        )
        .eq('active',true)
        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(error) throw error;


    const allMessages = messages || [];


    // =====================================================
    // 📥 MESSAGES REÇUS
    // =====================================================

    const received =
      allMessages.filter(
        message =>
          message.receiver_id === member.id
      );


    // =====================================================
    // 📤 MESSAGES ENVOYÉS
    // =====================================================

    const sent =
      allMessages.filter(
        message =>
          message.sender_id === member.id
      );


    openModal(`

      <h2>
        ✉️ Messagerie
      </h2>


      <!-- =================================================
           📥 MESSAGES REÇUS
           ================================================= -->

      <div class="card">

        <h3>
          📥 Messages reçus
        </h3>


        ${
          received.length

            ? `

              ${received.map(message => `

                <div
                  class="card"
                  onclick="openMemberMessage('${message.id}')"
                  style="
                    margin-top:10px;
                    cursor:pointer;
                  "
                >

                  <div
                    style="
                      font-weight:bold;
                    "
                  >

                    👔 Bureau Amicale

                  </div>


                  <div
                    style="
                      margin-top:5px;
                    "
                  >

                    ${esc(
                      message.subject ||
                      'Sans objet'
                    )}

                  </div>


                  <small class="muted">

                    📅
                    ${new Date(
                      message.created_at
                    ).toLocaleDateString('fr-FR')}

                    ${
                      message.read_at
                        ? ' · Lu'
                        : ' · 🔴 Non lu'
                    }

                  </small>

                </div>

              `).join('')}

            `

            : `

              <p class="muted">
                📭 Aucun message reçu.
              </p>

            `
        }

      </div>


      <!-- =================================================
           📤 MESSAGES ENVOYÉS
           ================================================= -->

      <div
        class="card"
        style="margin-top:15px;"
      >

        <h3>
          📤 Messages envoyés
        </h3>


        ${
          sent.length

            ? `

              ${sent.map(message => `

                <div
                  class="card"
                  onclick="openMemberMessage('${message.id}')"
                  style="
                    margin-top:10px;
                    cursor:pointer;
                  "
                >

                  <div
                    style="
                      font-weight:bold;
                    "
                  >

                    👤 Vous → Bureau Amicale

                  </div>


                  <div
                    style="
                      margin-top:5px;
                    "
                  >

                    ${esc(
                      message.subject ||
                      'Sans objet'
                    )}

                  </div>


                  <small class="muted">

                    📅
                    ${new Date(
                      message.created_at
                    ).toLocaleDateString('fr-FR')}

                  </small>

                </div>

              `).join('')}

            `

            : `

              <p class="muted">
                📭 Aucun message envoyé.
              </p>

            `
        }

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="secondary"
          onclick="newMemberMessage()"
        >

          ✉️ Nouveau message

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR MESSAGERIE MEMBRE :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger la messagerie.'
    );

  }

}


window.showMemberMessaging =
  showMemberMessaging;


async function openMemberMessage(messageId){

  if(!member?.id){

    alert(
      'Vous devez être connecté.'
    );

    return;

  }


  try{

    // =====================================================
    // 📨 CHARGER LE MESSAGE
    // =====================================================

    const {data:message,error} =
      await db
        .from('member_messages')
        .select(`
          id,
          sender_id,
          receiver_id,
          subject,
          content,
          created_at,
          read_at,
          parent_id
        `)
        .eq(
          'id',
          messageId
        )
        .single();


    if(error)
      throw error;


    if(!message){

      alert(
        'Message introuvable.'
      );

      return;

    }


    // =====================================================
    // 👁️ MARQUER COMME LU
    // =====================================================

    if(
      message.receiver_id === member.id &&
      !message.read_at
    ){

      const {error:readError} =
        await db
          .from('member_messages')
          .update({

            read_at:
              new Date().toISOString()

          })
          .eq(
            'id',
            message.id
          );


      if(readError){

        console.error(
          'ERREUR MARQUAGE MESSAGE LU :',
          readError
        );

      }

    }


    // =====================================================
    // 📨 AFFICHAGE
    // =====================================================

    const isReceived =
      message.receiver_id === member.id;


    openModal(`

      <h2>
        ${
          isReceived
            ? '👔 Bureau Amicale'
            : '📤 Message envoyé'
        }
      </h2>


      <div
        class="card"
        style="
          margin-top:15px;
        "
      >

        <h3>

          ${esc(
            message.subject ||
            'Sans objet'
          )}

        </h3>


        <p
          style="
            white-space:pre-wrap;
            margin-top:15px;
          "
        >

          ${esc(
            message.content || ''
          )}

        </p>


        ${
          message.created_at

            ? `

              <small class="muted">

                📅
                ${new Date(
                  message.created_at
                ).toLocaleString(
                  'fr-FR'
                )}

              </small>

            `

            : ''
        }


        ${
          isReceived

            ? `

              <div
                style="
                  margin-top:10px;
                  font-size:13px;
                  opacity:0.75;
                "
              >

                👁️ Message lu

              </div>

            `

            : ''

        }

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="showMemberMessaging()"
        >

          ← Retour à la messagerie

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR OUVERTURE MESSAGE MEMBRE :',
      error
    );

    alert(
      error.message ||
      'Impossible d’ouvrir le message.'
    );

  }

}


window.openMemberMessage =
  openMemberMessage;
async function openUserMessage(noteId){

  try{

    const {data:note,error} =
      await db
        .from('admin_notes')
        .select(
          'id,title,content,created_at'
        )
        .eq(
          'id',
          noteId
        )
        .eq(
          'active',
          true
        )
        .single();


    if(error)throw error;


    if(!note){

      alert(
        'Message introuvable.'
      );

      return;

    }


    // =====================================================
    // 👁️ ENREGISTRER LA LECTURE
    // =====================================================

if(member?.id){

  const {error:readError} =
    await db
      .from('admin_note_reads')
      .upsert(
        {
          note_id:note.id,
          member_id:member.id,
          read_at:new Date().toISOString()
        },
        {
          onConflict:'note_id,member_id'
        }
      );

  if(readError){

    console.error(
      'ERREUR ENREGISTREMENT LECTURE :',
      readError
    );

  }

}

    // =====================================================
    // 📨 AFFICHAGE DU MESSAGE
    // =====================================================

    openModal(`

      <h2>
        📝
        ${esc(
          note.title ||
          'Message de l’administrateur'
        )}
      </h2>


      <div
        class="card"
        style="
          margin-top:15px;
        "
      >

        <p
          style="
            white-space:pre-wrap;
          "
        >
          ${esc(
            note.content || ''
          )}
        </p>


        ${
          note.created_at

            ? `

              <small
                class="muted"
              >

                📅
                ${new Date(
                  note.created_at
                ).toLocaleDateString(
                  'fr-FR'
                )}

              </small>

            `

            : ''
        }

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="showUserMessages()"
        >

          ← Retour aux messages

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR OUVERTURE MESSAGE :',
      error
    );

    alert(
      'Impossible d’ouvrir le message :\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}


window.openUserMessage =
  openUserMessage;
/* ============================================================
   📢 PUBLICATIONS — ESPACE MEMBRE
   ============================================================ */

/* ============================================================
   📢 PUBLICATIONS — ESPACE MEMBRE
   ============================================================ */

async function loadMemberPublications(){

  try{

    /* ======================================================
       TROUVER LE CONTENEUR
       ====================================================== */

    let container =
      document.getElementById(
        'memberPublicationsContent'
      );


    /*
     * Si le sous-conteneur n'existe pas,
     * on utilise directement le bloc principal.
     */

    if(!container){

      container =
        document.getElementById(
          'memberPublications'
        );

    }


    if(!container){

      console.warn(
        '❌ Bloc publications introuvable.'
      );

      return;

    }


    /* ======================================================
       CHARGEMENT
       ====================================================== */

    /*
     * Si on utilise le bloc principal,
     * on ne remplace pas son titre.
     */

    const contentContainer =
      document.getElementById(
        'memberPublicationsContent'
      );


    if(contentContainer){

      contentContainer.innerHTML = `
        <div
          style="
            text-align:center;
            padding:10px;
          "
        >
          Chargement...
        </div>
      `;

    }else{

      /*
       * Ancienne structure :
       * on affiche temporairement le chargement
       */

      container.innerHTML = `

        <div
          style="
            font-size:18px;
            font-weight:700;
            margin-bottom:14px;
          "
        >
          📢 Publications
        </div>

        <div>
          Chargement...
        </div>

      `;

    }


    /* ======================================================
       RÉCUPÉRER LES PUBLICATIONS
       ====================================================== */

    const {
      data: publications,
      error
    } = await db
      .from('publications')
      .select('*')
      .eq('active', true)
      .order(
        'created_at',
        {
          ascending:false
        }
      );


if(error){

  alert(
    'Erreur publications : ' +
    error.message
  );

  throw error;

}

    /* ======================================================
       CONTENEUR FINAL
       ====================================================== */

    const target =
      document.getElementById(
        'memberPublicationsContent'
      ) || container;


    /* ======================================================
       AUCUNE PUBLICATION
       ====================================================== */

    if(
      !publications ||
      publications.length === 0
    ){

      target.innerHTML = `

        <div
          style="
            text-align:center;
            padding:20px;
            color:#64748b;
          "
        >

          📭 Aucune publication.

        </div>

      `;

      return;

    }


    /* ======================================================
       AFFICHAGE
       ====================================================== */

    target.innerHTML =
      publications
        .map(publication => {

          const type =
            publication.type ||
            'message';


          const icon =
            type === 'affiche'
              ? '🖼️'
              : type === 'document'
                ? '📄'
                : '💬';


          const typeLabel =
            type === 'affiche'
              ? 'Affiche'
              : type === 'document'
                ? 'Document'
                : 'Message';


          const date =
            publication.created_at
              ? new Date(
                  publication.created_at
                ).toLocaleString(
                  'fr-FR',
                  {
                    day:'2-digit',
                    month:'2-digit',
                    year:'numeric',
                    hour:'2-digit',
                    minute:'2-digit'
                  }
                )
              : '';


          return `

            <div
              class="card"
              style="
                margin-bottom:14px;
                padding:16px;
                max-width:100%;
                box-sizing:border-box;
                overflow:hidden;
              "
            >

              <!-- EN-TÊTE -->

              <div
                style="
                  display:flex;
                  align-items:flex-start;
                  gap:12px;
                  min-width:0;
                "
              >

                <div
                  style="
                    font-size:28px;
                    flex-shrink:0;
                  "
                >
                  ${icon}
                </div>


                <div
                  style="
                    flex:1;
                    min-width:0;
                    overflow:hidden;
                  "
                >

                  <div
                    style="
                      font-size:17px;
                      font-weight:700;
                      overflow-wrap:anywhere;
                      word-break:break-word;
                    "
                  >

                    ${esc(
                      publication.title ||
                      'Publication'
                    )}

                  </div>


                  <div
                    class="muted"
                    style="
                      margin-top:4px;
                      font-size:12px;
                    "
                  >

                    ${esc(typeLabel)}

                    ${
                      date
                        ? ` • ${esc(date)}`
                        : ''
                    }

                  </div>

                </div>

              </div>


              <!-- CONTENU -->

              ${
                publication.content

                  ? `

                    <div
                      style="
                        margin-top:14px;
                        white-space:pre-wrap;
                        overflow-wrap:anywhere;
                        word-break:break-word;
                        max-width:100%;
                        box-sizing:border-box;
                        overflow:hidden;
                      "
                    >

                      ${esc(
                        publication.content
                      )}

                    </div>

                  `

                  : ''

              }


              <!-- FICHIER -->

              ${
                publication.file_url

                  ? `

                    <div
                      style="
                        margin-top:14px;
                      "
                    >

                      <a
                        href="${esc(
                          publication.file_url
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="primary"
                        style="
                          display:inline-block;
                          text-decoration:none;
                        "
                      >

                        ${
                          type === 'affiche'
                            ? '🖼️ Voir l’affiche'
                            : '📄 Ouvrir le document'
                        }

                      </a>

                    </div>

                  `

                  : ''

              }

            </div>

          `;

        })
        .join('');


  }catch(error){

    console.error(
      '❌ ERREUR CHARGEMENT PUBLICATIONS MEMBRE :',
      error
    );


    const target =
      document.getElementById(
        'memberPublicationsContent'
      ) ||
      document.getElementById(
        'memberPublications'
      );


    if(target){

      target.innerHTML = `

        <div
          style="
            text-align:center;
            padding:20px;
            color:#b91c1c;
          "
        >

          ❌ Impossible de charger les publications.

        </div>

      `;

    }

  }

}


window.loadMemberPublications =
  loadMemberPublications;

/* ============================================================
   🔔 NOTIFICATIONS EN TEMPS RÉEL
   ============================================================ */

function startMemberNotificationsRealtime(){

  try{

    if(
      !member ||
      !member.id
    ){

      return;

    }


    /* Éviter plusieurs abonnements */

    if(
      window.memberNotificationsChannel
    ){

      return;

    }


    window.memberNotificationsChannel =
      db
        .channel(
          'member-notifications-' +
          member.id
        )

        .on(
          'postgres_changes',
          {
            event:'INSERT',
            schema:'public',
            table:'notifications',
            filter:
              'member_id=eq.' +
              member.id
          },

          async payload => {

            if(
              !payload ||
              !payload.new
            ){

              return;

            }


            /* ==========================================
               🔔 NOUVELLE NOTIFICATION
               ========================================== */

            await updateNotificationBadge();


            /* ==========================================
               📱 ACTUALISER LE BLOC NOTIFICATIONS
               ========================================== */

            const badge =
              $('notificationBadge');


            if(badge){

              badge.style.display =
                'inline-block';

            }

          }

        )

        .subscribe();

  }catch(error){

    console.error(
      'ERREUR NOTIFICATIONS TEMPS RÉEL :',
      error
    );

  }

}


window.startMemberNotificationsRealtime =
  startMemberNotificationsRealtime;

function renderHome(){

  
  if(!member){console.error('Aucun membre connecté.');return;}
  if(String(member.role).toLowerCase()==='admin')renderAdmin();else renderUser();
}

async function renderUser(){

  if(!member){
    console.error('Aucun membre connecté.');
    return;
  }


  console.log('========== MEMBRE CONNECTÉ ==========');
  console.log('member complet :', member);
  console.log('bureau_member :', member?.bureau_member);
  console.log('type :', typeof member?.bureau_member);
  console.log('role :', member?.role);
  console.log('====================================');


  // ==========================================================
  // ESPACE MEMBRE
  // ==========================================================

  $('homeAdmin')?.classList.add('hidden');
  $('homeUser')?.classList.remove('hidden');


  // ==========================================================
  // DOCUMENTS / SUJETS RÉSERVÉS AU BUREAU
  // ==========================================================

  const meetingSubjectBlock =
    member?.bureau_member === true
      ? `

        <div class="card">

          <h3>
            🗣️ Sujets à aborder en réunion
          </h3>

          <p>
            Proposez un sujet à aborder
            lors d'une prochaine réunion.
          </p>

          <button
            type="button"
            class="primary"
            onclick="showMeetingSubjectForm()"
          >
            ➕ Ajouter un sujet à aborder
          </button>

        </div>

      `
      : '';


  const bureauDocumentsBlock =
    member?.bureau_member === true
      ? `

        <div class="card">

          <h3>
            📄 Documents de travail du bureau
          </h3>

          <p>
            Consultez les documents de travail
            réservés aux membres du bureau.
          </p>

          <button
            type="button"
            class="primary"
            onclick="openBureauWorkDocumentsUser()"
          >
            📂 Voir les documents
          </button>

        </div>

      `
      : '';

    // ==========================================================
  // 📊 SONDAGES RÉSERVÉS AUX MEMBRES DU BUREAU
  // ==========================================================

  const bureauPollsUserBlock =
    member?.bureau_member === true
      ? `

        <div class="card">

          <h3>
            📊 Sondages du bureau
          </h3>

          <p>
            Consultez les sondages réservés aux membres
            du bureau et participez aux votes.
          </p>

          <button
            type="button"
            class="primary"
            onclick="showBureauPollsUser()"
          >
            📝 Voir les sondages
          </button>

        </div>

      `
      : '';

  

  // ==========================================================
  // RÉCUPÉRATION DU MEMBRE COMPLET
  // ==========================================================

  let currentMember = member;

  try{

    const {
      data,
      error
    } = await db
      .from('members')
      .select('*')
      .eq('id', member.id)
      .single();


    if(!error && data){

      currentMember = data;

      // On actualise également le membre courant
      member = {
        ...member,
        ...data
      };

    }

  }catch(error){

    console.error(
      'Erreur récupération membre :',
      error
    );

  }


  // ==========================================================
  // CALCUL ENGAGEMENT + MÉDAILLES
  // MÊME LOGIQUE QUE showMyMedals()
  // ==========================================================

  let engagement = {
    years:0,
    months:0,
    days:0
  };


  let federationObtained = [];
  let unionObtained = [];

  let federationLast = null;
  let unionLast = null;

  let nextFederation = null;
  let nextUnion = null;

  let nextMedal = null;

  let nextMedalRemaining = '—';


  try{

    if(currentMember?.sp_entry_date){

      // --------------------------------------------------------
      // Périodes d'inactivité
      // --------------------------------------------------------

      const {
        data:inactivities,
        error:inactivityError
      } = await db
        .from('member_inactivity')
        .select('*')
        .eq(
          'member_id',
          currentMember.id
        );


      if(inactivityError){

        throw inactivityError;

      }


      const inactivityList =
        inactivities || [];


      // --------------------------------------------------------
      // Dates
      // --------------------------------------------------------

      const today =
        new Date();


      const entry =
        new Date(
          currentMember.sp_entry_date
        );


      if(!isNaN(entry.getTime())){


        // ======================================================
        // CALCUL TEMPS D'ENGAGEMENT
        // ======================================================

        let years =
          today.getFullYear()
          -
          entry.getFullYear();


        let months =
          today.getMonth()
          -
          entry.getMonth();


        let days =
          today.getDate()
          -
          entry.getDate();


        if(days < 0){

          months--;

          const previousMonth =
            new Date(
              today.getFullYear(),
              today.getMonth(),
              0
            );

          days +=
            previousMonth.getDate();

        }


        if(months < 0){

          years--;

          months += 12;

        }


        // ------------------------------------------------------
        // Retrait des périodes d'inactivité
        // Même logique que showMyMedals()
        // ------------------------------------------------------

        inactivityList.forEach(i=>{

          if(!i.start_date){

            return;

          }


          const start =
            new Date(
              i.start_date
            );


          let end =
            i.end_date
              ? new Date(i.end_date)
              : new Date(today);


          if(isNaN(start.getTime())){

            return;

          }


          if(isNaN(end.getTime())){

            end =
              new Date(today);

          }


          if(start < entry){

            start.setTime(
              entry.getTime()
            );

          }


          if(end > today){

            end =
              new Date(today);

          }


          if(end <= start){

            return;

          }


          let inactiveYears =
            end.getFullYear()
            -
            start.getFullYear();


          let inactiveMonths =
            end.getMonth()
            -
            start.getMonth();


          let inactiveDays =
            end.getDate()
            -
            start.getDate();


          if(inactiveDays < 0){

            inactiveMonths--;

            const previousMonth =
              new Date(
                end.getFullYear(),
                end.getMonth(),
                0
              );

            inactiveDays +=
              previousMonth.getDate();

          }


          if(inactiveMonths < 0){

            inactiveYears--;

            inactiveMonths += 12;

          }


          years -=
            inactiveYears;


          months -=
            inactiveMonths;


          days -=
            inactiveDays;


          if(days < 0){

            days += 30;

            months--;

          }


          if(months < 0){

            months += 12;

            years--;

          }

        });




        engagement = {

          years:Math.max(
            0,
            years
          ),

          months:Math.max(
            0,
            months
          ),

          days:Math.max(
            0,
            days
          )

        };


        // ======================================================
        // BARÈMES EXISTANTS
        // ======================================================

        const federation = [

          {
            months:120,
            name:'Bronze',
            emoji:'🥉'
          },

          {
            months:240,
            name:'Argent',
            emoji:'🥈'
          },

          {
            months:360,
            name:'Or',
            emoji:'🥇'
          }

        ];


        const union = [

          {
            months:84,
            name:'Cuivre',
            emoji:'🟤'
          },

          {
            months:180,
            name:'Bronze',
            emoji:'🥉'
          },

          {
            months:240,
            name:'Argent',
            emoji:'🥈'
          },

          {
            months:360,
            name:'Or',
            emoji:'🥇'
          }

        ];


     let seniorityMonths =
  engagement.years * 12
  +
  engagement.months;


// Ancien JSP : +12 mois uniquement
// pour déterminer les médailles
if(currentMember.was_jsp === true){

  seniorityMonths += 12;

}

        // ======================================================
        // MÉDAILLES OBTENUES
        // ======================================================

        federationObtained =
          federation.filter(
            m =>
              seniorityMonths >=
              m.months
          );


        unionObtained =
          union.filter(
            m =>
              seniorityMonths >=
              m.months
          );


        federationLast =
          federationObtained.length
            ? federationObtained[
                federationObtained.length - 1
              ]
            : null;


        unionLast =
          unionObtained.length
            ? unionObtained[
                unionObtained.length - 1
              ]
            : null;


        // ======================================================
        // PROCHAINES MÉDAILLES
        // ======================================================

        nextFederation =
          federation.find(
            m =>
              seniorityMonths <
              m.months
          );


        nextUnion =
          union.find(
            m =>
              seniorityMonths <
              m.months
          );


        // ======================================================
        // DATE D'OBTENTION D'UNE MÉDAILLE
        // Même logique que showMyMedals()
        // ======================================================

        function addMonths(
          date,
          months
        ){

          const result =
            new Date(date);

          result.setMonth(
            result.getMonth()
            +
            months
          );

          return result;

        }


     function getMedalDate(medal){

  if(!medal){

    return null;

  }


  if(
    !currentMember ||
    !currentMember.sp_entry_date
  ){

    return null;

  }


  // ==========================================================
  // ANCIENNETÉ RÉELLE DU MEMBRE
  // ==========================================================
  //
  // On reprend exactement la même logique que
  // getSeniorityMonths().
  //
  // IMPORTANT :
  // les périodes d'inactivité sont déjà déduites ici.
  // Elles ne seront donc PAS rajoutées une deuxième fois.
  //
  // ==========================================================

  const entry =
    new Date(
      currentMember.sp_entry_date
    );


  if(
    isNaN(entry.getTime())
  ){

    return null;

  }


  let months =

    (
      today.getFullYear() -
      entry.getFullYear()
    ) * 12

    +

    (
      today.getMonth() -
      entry.getMonth()
    );


  if(
    today.getDate() <
    entry.getDate()
  ){

    months--;

  }


  // ==========================================================
  // RETRAIT DE TOUTES LES PÉRIODES D'INACTIVITÉ
  // ==========================================================

  inactivityList
    .filter(
      inactivity =>
        String(inactivity.member_id) ===
        String(currentMember.id)
    )
    .forEach(
      inactivity => {

        if(
          !inactivity.start_date
        ){

          return;

        }


        let start =
          new Date(
            inactivity.start_date
          );


        if(
          isNaN(start.getTime())
        ){

          return;

        }


        let end =
          inactivity.end_date
            ? new Date(inactivity.end_date)
            : new Date(today);


        if(
          isNaN(end.getTime())
        ){

          end =
            new Date(today);

        }


        if(
          start < entry
        ){

          start =
            new Date(entry);

        }


        if(
          start >= today
        ){

          return;

        }


        if(
          end > today
        ){

          end =
            new Date(today);

        }


        if(
          end <= start
        ){

          return;

        }


        let inactiveMonths =

          (
            end.getFullYear() -
            start.getFullYear()
          ) * 12

          +

          (
            end.getMonth() -
            start.getMonth()
          );


        if(
          end.getDate() <
          start.getDate()
        ){

          inactiveMonths--;

        }


        inactiveMonths =
          Math.max(
            0,
            inactiveMonths
          );


        months -=
          inactiveMonths;

      }
    );


  months =
    Math.max(
      0,
      months
    );


  // ==========================================================
  // BONUS ANCIEN JSP
  // ==========================================================
  //
  // Les 12 mois ne sont PAS ajoutés à l'ancienneté affichée.
  //
  // Ils servent uniquement à savoir quand la médaille
  // est atteinte.
  //
  // ==========================================================

  let medalMonths =
    months;


  if(
    currentMember.was_jsp === true
  ){

    medalMonths += 12;

  }


  // ==========================================================
  // NOMBRE DE MOIS RESTANTS AVANT LA MÉDAILLE
  // ==========================================================

  const remainingMonths =
    medal.months -
    medalMonths;


  // ==========================================================
  // MÉDAILLE DÉJÀ ATTEINTE
  // ==========================================================

  if(
    remainingMonths <= 0
  ){

    return new Date(today);

  }


  // ==========================================================
  // DATE PRÉVISIONNELLE
  // ==========================================================
  //
  // On part d'aujourd'hui et on ajoute uniquement
  // les mois d'ancienneté qui restent à accomplir.
  //
  // Aucune période d'inactivité n'est ajoutée ici :
  // elle a déjà été retirée de "months".
  //
  // ==========================================================

  const medalDate =
    new Date(today);


  medalDate.setMonth(
    medalDate.getMonth() +
    remainingMonths
  );


  return medalDate;

}

        
        function formatRemaining(
          targetDate
        ){

          if(!targetDate){

            return '—';

          }


          const target =
            new Date(targetDate);


          if(target <= today){

            return 'Dès maintenant';

          }


          let years =
            target.getFullYear()
            -
            today.getFullYear();


          let months =
            target.getMonth()
            -
            today.getMonth();


          let days =
            target.getDate()
            -
            today.getDate();


          if(days < 0){

            months--;

            const previousMonth =
              new Date(
                target.getFullYear(),
                target.getMonth(),
                0
              );

            days +=
              previousMonth.getDate();

          }


          if(months < 0){

            years--;

            months += 12;

          }


          const parts = [];


          if(years > 0){

            parts.push(
              `${years} an${years > 1 ? 's' : ''}`
            );

          }


          if(months > 0){

            parts.push(
              `${months} mois`
            );

          }


          if(days > 0){

            parts.push(
              `${days} jour${days > 1 ? 's' : ''}`
            );

          }


          return parts.length
            ? parts.join(' ')
            : 'Moins d’un jour';

        }


        // ------------------------------------------------------
        // Prochaine médaille fédération / union
        // ------------------------------------------------------

        const nextCandidates = [];


        if(nextFederation){

          const date =
            getMedalDate(
              nextFederation
            );


          if(date){

            nextCandidates.push({

              medal:nextFederation,

              type:'Fédération',

              date

            });

          }

        }


        if(nextUnion){

          const date =
            getMedalDate(
              nextUnion
            );


          if(date){

            nextCandidates.push({

              medal:nextUnion,

              type:'Union',

              date

            });

          }

        }


        nextCandidates.sort(
          (a,b)=>
            a.date.getTime()
            -
            b.date.getTime()
        );


        if(nextCandidates.length){

          nextMedal =
            nextCandidates[0];

          nextMedalRemaining =
            formatRemaining(
              nextMedal.date
            );

        }

      }

    }

  }catch(error){

    console.error(
      'ERREUR CALCUL ENGAGEMENT / MÉDAILLES :',
      error
    );

  }


  // ==========================================================
  // TEXTES ENGAGEMENT
  // ==========================================================

  const engagementText =

    currentMember?.sp_entry_date

      ? `${engagement.years} an${engagement.years > 1 ? 's' : ''} · ${engagement.months} mois · ${engagement.days} jour${engagement.days > 1 ? 's' : ''}`

      : 'Date d’engagement non renseignée';


  const federationYear =
    federationLast
      ? (() => {

          try{

            const d =
              new Date(
                currentMember.sp_entry_date
              );

            d.setMonth(
              d.getMonth()
              +
              federationLast.months
            );

            return d.getFullYear();

          }catch(e){

            return '—';

          }

        })()
      : null;


  const unionYear =
    unionLast
      ? (() => {

          try{

            const d =
              new Date(
                currentMember.sp_entry_date
              );

            d.setMonth(
              d.getMonth()
              +
              unionLast.months
            );

            return d.getFullYear();

          }catch(e){

            return '—';

          }

        })()
      : null;


  // ==========================================================
  // PROCHAINE FESTIVITÉ
  // ==========================================================

  let nextEvent = null;


  try{

    const {
      data,
      error
    } = await db
      .from('events')
      .select('*')
      .eq('active',true)
      .eq('archived',false)
      .gte(
        'event_date',
        new Date()
          .toISOString()
          .slice(0,10)
      )
      .order(
        'event_date',
        {
          ascending:true
        }
      )
      .order(
        'event_time',
        {
          ascending:true
        }
      )
      .limit(1);


    if(!error && data?.length){

      nextEvent =
        data[0];

    }

  }catch(error){

    console.error(
      'ERREUR PROCHAINE FESTIVITÉ :',
      error
    );

  }


  let eventHtml = `

    <div
      style="
        padding:18px;
        text-align:center;
        color:#6b7280;
      "
    >
      📭 Aucune prochaine festivité.
    </div>

  `;


  if(nextEvent){

    eventHtml = `

      <div
        style="
          position:relative;
          overflow:hidden;
          border-radius:18px;
          min-height:210px;
          background:#111;
          cursor:pointer;
        "
        onclick="showEvents()"
      >

        <img
          src="/assets/fete.png"
          alt="Prochaine festivité"
          style="
            width:100%;
            height:210px;
            object-fit:cover;
            display:block;
          "
        >

        <div
          style="
            position:absolute;
            inset:0;
            background:
              linear-gradient(
                180deg,
                rgba(0,0,0,.05),
                rgba(0,0,0,.82)
              );
          "
        ></div>


        <div
          style="
            position:absolute;
            left:18px;
            right:18px;
            bottom:18px;
            color:white;
          "
        >

          <div
            style="
              display:inline-block;
              padding:6px 10px;
              border-radius:8px;
              background:#c1121f;
              color:white;
              font-size:12px;
              font-weight:800;
              margin-bottom:8px;
            "
          >
            PROCHAINE FESTIVITÉ
          </div>


          <div
            style="
              font-size:22px;
              font-weight:900;
            "
          >
            ${esc(
              nextEvent.title ||
              'Festivité'
            )}
          </div>


          <div
            style="
              margin-top:6px;
              font-size:14px;
              line-height:1.6;
            "
          >

            📅
            ${
              nextEvent.event_date
                ? fmtDate(
                    nextEvent.event_date
                  )
                : 'Date à préciser'
            }

            ${
              nextEvent.event_time
                ? ` · 🕐 ${esc(
                    nextEvent.event_time.slice(0,5)
                  )}`
                : ''
            }

            ${
              nextEvent.location
                ? `<br>📍 ${esc(nextEvent.location)}`
                : ''
            }

          </div>

        </div>

      </div>

    `;

  }


  // ==========================================================
  // MÉDAILLE FÉDÉRATION
  // ==========================================================

  const federationMedalHtml =

    federationLast

      ? `

        <div
          style="
            flex:1;
            min-width:100px;
            text-align:center;
          "
        >

          <div
            style="
              font-size:42px;
              line-height:1;
            "
          >
            ${federationLast.emoji}
          </div>

          <div
            style="
              margin-top:7px;
              font-weight:800;
              font-size:14px;
            "
          >
            ${esc(
              federationLast.name
            )}
          </div>

          <div
            style="
              color:#6b7280;
              font-size:12px;
              margin-top:3px;
            "
          >
            Fédération
          </div>

          <div
            style="
              color:#6b7280;
              font-size:12px;
            "
          >
            ${federationYear || '—'}
          </div>

        </div>

      `

      : `

        <div
          style="
            flex:1;
            min-width:100px;
            text-align:center;
            color:#9ca3af;
          "
        >

          <div
            style="
              font-size:42px;
              opacity:.3;
            "
          >
            🏅
          </div>

          <div
            style="
              font-weight:700;
              font-size:13px;
            "
          >
            Aucune
          </div>

          <div
            style="
              font-size:12px;
            "
          >
            Fédération
          </div>

        </div>

      `;


  // ==========================================================
  // MÉDAILLE UNION
  // ==========================================================

  const unionMedalHtml =

    unionLast

      ? `

        <div
          style="
            flex:1;
            min-width:100px;
            text-align:center;
          "
        >

          <div
            style="
              font-size:42px;
              line-height:1;
            "
          >
            ${unionLast.emoji}
          </div>

          <div
            style="
              margin-top:7px;
              font-weight:800;
              font-size:14px;
            "
          >
            ${esc(
              unionLast.name
            )}
          </div>

          <div
            style="
              color:#6b7280;
              font-size:12px;
              margin-top:3px;
            "
          >
            Union
          </div>

          <div
            style="
              color:#6b7280;
              font-size:12px;
            "
          >
            ${unionYear || '—'}
          </div>

        </div>

      `

      : `

        <div
          style="
            flex:1;
            min-width:100px;
            text-align:center;
            color:#9ca3af;
          "
        >

          <div
            style="
              font-size:42px;
              opacity:.3;
            "
          >
            🏅
          </div>

          <div
            style="
              font-weight:700;
              font-size:13px;
            "
          >
            Aucune
          </div>

          <div
            style="
              font-size:12px;
            "
          >
            Union
          </div>

        </div>

      `;


  // ==========================================================
  // PROCHAINE MÉDAILLE
  // ==========================================================

  const nextMedalHtml =

    nextMedal

      ? `

        <div
          style="
            flex:1;
            min-width:115px;
            text-align:center;
          "
        >

          <div
            style="
              font-size:42px;
              line-height:1;
              opacity:.65;
            "
          >
            ${nextMedal.medal.emoji}
          </div>

          <div
            style="
              font-weight:800;
              font-size:13px;
              margin-top:7px;
            "
          >
            Prochaine
          </div>

          <div
            style="
              font-size:12px;
              color:#6b7280;
            "
          >
            ${esc(
              nextMedal.medal.name
            )}
            ·
            ${esc(
              nextMedal.type
            )}
          </div>

          <div
            style="
              font-size:12px;
              color:#6b7280;
              margin-top:3px;
            "
          >
            Dans ${esc(
              nextMedalRemaining
            )}
          </div>

        </div>

      `

      : `

        <div
          style="
            flex:1;
            min-width:115px;
            text-align:center;
            color:#9ca3af;
          "
        >

          <div
            style="
              font-size:42px;
              opacity:.3;
            "
          >
            🏅
          </div>

          <div
            style="
              font-weight:700;
              font-size:13px;
            "
          >
            Toutes obtenues
          </div>

        </div>

      `;

 // ==========================================================
// 🧭 MENU BURGER MEMBRE — VERSION MODERNE
// ==========================================================

window.showMemberMenu = function(){

  openModal(`

    <div
      style="
        width:100%;
        max-width:620px;
        margin:auto;
      "
    >

      <!-- ==================================================
           EN-TÊTE
           ================================================== -->

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-bottom:24px;
        "
      >

        <div>

          <div
            style="
              display:flex;
              align-items:center;
              gap:10px;
            "
          >

            <div
              style="
                width:42px;
                height:42px;
                border-radius:13px;
                background:#c8101e;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:21px;
                box-shadow:0 5px 15px rgba(200,16,30,.20);
              "
            >
              ☰
            </div>

            <div>

              <h2
                style="
                  margin:0;
                  font-size:24px;
                  font-weight:800;
                  line-height:1.1;
                "
              >
                Menu
              </h2>

              <div
                style="
                  margin-top:4px;
                  font-size:13px;
                  opacity:.60;
                "
              >
                Espace membre
              </div>

            </div>

          </div>

        </div>


        <!-- FERMER -->

        <button
          type="button"
          onclick="closeModal()"
          aria-label="Fermer"
          style="
            width:42px;
            height:42px;
            border-radius:13px;
            border:1px solid rgba(0,0,0,.10);
            background:transparent;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:25px;
            cursor:pointer;
            transition:.18s ease;
          "
          onmouseover="
            this.style.background='rgba(0,0,0,.05)';
            this.style.transform='scale(1.04)';
          "
          onmouseout="
            this.style.background='transparent';
            this.style.transform='scale(1)';
          "
        >
          ×
        </button>

      </div>


      <!-- ==================================================
           ACCÈS RAPIDES
           ================================================== -->

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap:12px;
        "
      >


        <!-- =================================================
             ÉVÉNEMENTS
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showEvents();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            🎉
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Événements
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Vie de l'amicale
          </div>

        </button>


        <!-- =================================================
             SONDAGES
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showPolls();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            📊
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Sondages
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Donner mon avis
          </div>

        </button>


        <!-- =================================================
             MATÉRIEL
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showMaterials();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            🧰
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Matériel
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Consulter le matériel
          </div>

        </button>


        <!-- =================================================
             BOÎTE À IDÉES
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showIdeaForm();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            💡
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Boîte à idées
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Proposer une idée
          </div>

        </button>


        <!-- =================================================
             COMPTES RENDUS
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showUserMeetingReports();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            📋
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Comptes rendus
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Réunions et informations
          </div>

        </button>


        <!-- =================================================
             MÉDAILLES
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showMyMedals();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            🏅
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Médailles
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Mon ancienneté et mes médailles
          </div>

        </button>

<!-- PROCURATIONS -->
<button
  type="button"
  onclick="closeModal(); showProcurations();"
  style="
    min-height:92px;
    border:0;
    border-radius:17px;
    background:#c8101e;
    color:white;
    cursor:pointer;
    padding:16px;
    text-align:left;
    font-family:inherit;
    box-shadow:0 5px 15px rgba(0,0,0,.08);
  "
>
  <div style="font-size:26px;">📝</div>
  <div style="margin-top:8px;font-size:16px;font-weight:800;">
    Procurations
  </div>
  <div style="margin-top:3px;font-size:12px;opacity:.75;">
    Donner ou modifier ma procuration
  </div>
</button>


        <!-- =================================================
             TOURNÉE DE CALENDRIER
             ================================================= -->

        <button
          type="button"
          onclick="
            closeModal();
            showMyCalendarTour();
          "
          style="
            min-height:92px;
            border:0;
            border-radius:17px;
            background:#c8101e;
            color:white;
            cursor:pointer;
            padding:16px;
            text-align:left;
            font-family:inherit;
            box-shadow:0 5px 15px rgba(0,0,0,.08);
            transition:.18s ease;
          "
          onmouseover="
            this.style.transform='translateY(-2px)';
            this.style.boxShadow='0 8px 20px rgba(0,0,0,.12)';
          "
          onmouseout="
            this.style.transform='translateY(0)';
            this.style.boxShadow='0 5px 15px rgba(0,0,0,.08)';
          "
        >

          <div style="font-size:26px;">
            🧭
          </div>

          <div
            style="
              margin-top:8px;
              font-size:16px;
              font-weight:800;
            "
          >
            Ma tournée
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              opacity:.75;
            "
          >
            Commune, secteur et référent
          </div>

        </button>

      </div>


      <!-- ==================================================
           SÉPARATION
           ================================================== -->

      <div
        style="
          height:1px;
          background:rgba(0,0,0,.08);
          margin:22px 0 16px;
        "
      ></div>


      <!-- ==================================================
           CHANGER LE CODE
           ================================================== -->

      <button
        type="button"
        onclick="
          closeModal();
          changeMyCode();
        "
        style="
          width:100%;
          min-height:64px;
          border:1px solid rgba(0,0,0,.10);
          border-radius:16px;
          background:transparent;
          color:inherit;
          cursor:pointer;
          padding:14px 18px;
          font-family:inherit;
          display:flex;
          align-items:center;
          gap:14px;
          text-align:left;
          transition:.18s ease;
        "
        onmouseover="
          this.style.background='rgba(200,16,30,.06)';
          this.style.borderColor='rgba(200,16,30,.25)';
        "
        onmouseout="
          this.style.background='transparent';
          this.style.borderColor='rgba(0,0,0,.10)';
        "
      >

        <span
          style="
            width:38px;
            height:38px;
            border-radius:11px;
            background:rgba(200,16,30,.10);
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:20px;
          "
        >
          🔑
        </span>

        <span>

          <strong
            style="
              display:block;
              font-size:15px;
            "
          >
            Changer mon code
          </strong>

          <small
            style="
              display:block;
              margin-top:3px;
              opacity:.60;
            "
          >
            Modifier mon code d'accès
          </small>

        </span>

      </button>


    </div>

  `);

};
  // ==========================================================
  // AFFICHAGE
  // ==========================================================

  $('homeUser').innerHTML = `

    <!-- =====================================================
         PHOTO FOND
         ===================================================== -->

    <div
      style="
        position:relative;
        overflow:hidden;
        border-radius:22px;
        height:215px;
        margin-bottom:16px;
        background:#111;
      "
    >

      <img
        src="/assets/fond.png"
        alt="Caserne"
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
        "
      >

      <div
        style="
          position:absolute;
          inset:0;
          background:
            linear-gradient(
              180deg,
              transparent 20%,
              rgba(0,0,0,.68)
            );
        "
      ></div>


      <div
        style="
          position:absolute;
          left:20px;
          bottom:18px;
          color:white;
        "
      >

        <div
          style="
            font-size:14px;
            font-weight:700;
            text-transform:uppercase;
          "
        >
          Amicale
        </div>

        <div
          style="
            font-size:25px;
            font-weight:900;
            line-height:1.1;
          "
        >
          Sapeurs-Pompiers
        </div>

        <div
          style="
            font-size:18px;
            font-weight:700;
          "
        >
          Bailleul
        </div>

      </div>

    </div>


    <!-- =====================================================
         BIENVENUE
         ===================================================== -->

    <div
      class="card"
      style="
        border-radius:20px;
        margin-bottom:16px;
      "
    >

      <h2
        style="
          margin:0 0 5px;
          font-size:25px;
        "
      >
        Bonjour
        ${esc(member.first_name)}
        👋
      </h2>

      <p
        style="
          margin:0;
          color:#6b7280;
        "
      >
        Bienvenue dans votre espace membre.
      </p>

    </div>


    <!-- =====================================================
         NOTIFICATIONS
         ===================================================== -->

    <div
      class="card"
      style="
        border-radius:20px;
        margin-bottom:16px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
        "
      >

        <div>

          <h3
            style="
              margin:0;
            "
          >
            🔔 Notifications
          </h3>

          <p
            style="
              margin:6px 0 0;
              color:#6b7280;
              font-size:14px;
            "
          >
            Les nouvelles informations
            de l'Amicale apparaîtront ici.
          </p>

        </div>


        <button
          type="button"
          class="primary"
          onclick="showNotifications()"
          style="
            white-space:nowrap;
          "
        >
          🔔 Voir
        </button>

      </div>


      <span
        id="notificationBadge"
        style="
          display:none;
          margin-top:10px;
          padding:6px 10px;
          border-radius:8px;
          background:#c1121f;
          color:white;
          font-size:12px;
          font-weight:bold;
        "
      >
        🆕 NOUVELLE PUBLICATION
      </span>

    </div>
<!-- ============================================================
     📢 PUBLICATIONS
     ============================================================ -->

<div
  id="memberPublications"
  class="card"
  style="
    margin-bottom:16px;
  "
>

  <div
    style="
      font-size:18px;
      font-weight:700;
      margin-bottom:14px;
    "
  >
    📢 Publications
  </div>


  <div id="memberPublicationsContent">

    📭 Aucune publication.

  </div>

</div>
    <!-- =====================================================
         PROCHAINE FESTIVITÉ
         ===================================================== -->

    <div
      class="card"
      style="
        border-radius:20px;
        margin-bottom:16px;
        padding:12px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin:4px 6px 12px;
        "
      >

        <h3
          style="
            margin:0;
          "
        >
          🎉 Prochaine festivité
        </h3>


        <button
          type="button"
          class="ghost"
          onclick="showEvents()"
        >
          Voir tout
        </button>

      </div>


      ${eventHtml}

    </div>


    <!-- =====================================================
         MON ENGAGEMENT / MÉDAILLES
         STYLE 1
         ===================================================== -->

    <div
      class="card"
      style="
        border-radius:20px;
        margin-bottom:16px;
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          gap:14px;
          margin-bottom:14px;
        "
      >

        <div
          style="
            width:54px;
            height:54px;
            border-radius:16px;
            background:#fff3d6;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:32px;
            flex-shrink:0;
          "
        >
          🏅
        </div>


        <div>

          <div
            style="
              font-size:15px;
              font-weight:800;
            "
          >
            Mon engagement
          </div>

          <div
            style="
              margin-top:2px;
              color:#c1121f;
              font-size:19px;
              font-weight:900;
            "
          >
            ${esc(
              engagementText
            )}
          </div>

          <div
            style="
              color:#6b7280;
              font-size:12px;
              margin-top:3px;
            "
          >
            au sein de l'Amicale
          </div>

        </div>

      </div>


      <div
        style="
          font-size:15px;
          font-weight:800;
          margin-bottom:10px;
        "
      >
        Mes médailles
      </div>


      <div
        style="
          display:flex;
          align-items:stretch;
          gap:5px;
        "
      >

        ${federationMedalHtml}

        <div
          style="
            width:1px;
            background:#e5e7eb;
          "
        ></div>

        ${unionMedalHtml}

        <div
          style="
            width:1px;
            background:#e5e7eb;
          "
        ></div>

        ${nextMedalHtml}

      </div>


      <button
        type="button"
        class="ghost"
        onclick="showMyMedals()"
        style="
          width:100%;
          margin-top:15px;
        "
      >
        🏅 Voir toutes mes médailles
      </button>

    </div>


    <!-- =====================================================
         CAMION
         ===================================================== -->

    <div
      style="
        position:relative;
        overflow:hidden;
        border-radius:20px;
        height:205px;
        margin-bottom:16px;
        background:#111;
      "
    >

      <img
        src="/assets/camion.png"
        alt="Camion de sapeurs-pompiers"
        style="
          width:100%;
          height:100%;
          object-fit:cover;
          display:block;
        "
      >

      <div
        style="
          position:absolute;
          inset:0;
          background:
            linear-gradient(
              180deg,
              transparent 25%,
              rgba(0,0,0,.72)
            );
        "
      ></div>


      <div
        style="
          position:absolute;
          left:18px;
          bottom:16px;
          color:white;
          font-size:18px;
          font-weight:900;
        "
      >
        Amicale Sapeurs-Pompiers
      </div>

    </div>


<!-- =====================================================
     DOCUMENTS BUREAU
     ===================================================== -->

${bureauDocumentsBlock}


<!-- =====================================================
     📊 SONDAGES BUREAU
     ===================================================== -->

${bureauPollsUserBlock}


<!-- =====================================================
     SUJETS RÉUNION BUREAU
     ===================================================== -->

${meetingSubjectBlock}


    <!-- =====================================================
         PAS DE BLOC COMPTES RENDUS ICI
         Ils restent dans le menu burger
         ===================================================== -->


  


    <!-- =====================================================
         BARRE BASSE
         ICÔNES LÉGÈREMENT AGRANDIES
         ===================================================== -->

    <div
      style="
        position:sticky;
        bottom:0;
        z-index:30;
        margin-top:20px;
        padding:7px 5px;
        border-radius:18px 18px 0 0;
        background:rgba(255,255,255,.97);
        box-shadow:0 -4px 20px rgba(0,0,0,.10);
        backdrop-filter:blur(12px);
        display:grid;
        grid-template-columns:repeat(5,1fr);
        gap:2px;
      "
    >

      <button
        type="button"
        class="ghost"
        onclick="
          window.scrollTo({
            top:0,
            behavior:'smooth'
          })
        "
        style="
          border:0;
          padding:7px 2px;
          font-size:11px;
        "
      >

        <span
          style="
            display:block;
            font-size:25px;
            line-height:27px;
          "
        >
          🏠
        </span>

        Accueil

      </button>


      <button
        type="button"
        class="ghost"
        onclick="showMemberProfile()"
        style="
          border:0;
          padding:7px 2px;
          font-size:11px;
        "
      >

        <span
          style="
            display:block;
            font-size:25px;
            line-height:27px;
          "
        >
          👤
        </span>

        Profil

      </button>


      <button
        type="button"
        class="ghost"
        onclick="showCalendar()"
        style="
          border:0;
          padding:7px 2px;
          font-size:11px;
        "
      >

        <span
          style="
            display:block;
            font-size:25px;
            line-height:27px;
          "
        >
          📅
        </span>

        Calendrier

      </button>


     <!-- =====================================================
     💬 MESSAGERIE
====================================================== -->

<button
  type="button"
  class="ghost"
  onclick="openMessaging()"
  style="
    border:0;
    padding:7px 2px;
    font-size:11px;
    position:relative;
  "
>

  <span
    style="
      display:inline-block;
      position:relative;
      font-size:25px;
      line-height:27px;
    "
  >

    💬

    <span
      id="conversationUnreadBadge"
      style="
        display:none;
        position:absolute;
        top:-7px;
        right:-9px;
        min-width:18px;
        height:18px;
        padding:0 4px;
        border-radius:50%;
        background:#e53935;
        color:#fff;
        font-size:10px;
        font-weight:700;
        line-height:18px;
        text-align:center;
        box-sizing:border-box;
        z-index:10;
      "
    >1</span>

  </span>

  <span style="display:block;">
    Messagerie
  </span>

</button>

      <button
        type="button"
        class="ghost"
        onclick="showMemberMenu()"
        style="
          border:0;
          padding:7px 2px;
          font-size:11px;
        "
      >

        <span
          style="
            display:block;
            font-size:25px;
            line-height:27px;
          "
        >
          ☰
        </span>

        Menu

      </button>

    </div>

  `;


  // ==========================================================
  // NOTIFICATIONS
  // ==========================================================

  startNotificationCheck();
  loadMemberPublications();
  startMemberNotificationsRealtime();
}

/* ============================================================
   📊 SONDAGES BUREAU — ESPACE MEMBRE
   Lecture et réponse uniquement
   ============================================================ */

async function showBureauPollsUser(){

  if(
    !member ||
    member.bureau_member !== true
  ){

    alert(
      '❌ Cette section est réservée aux membres du bureau.'
    );

    return;

  }


  try{

    const {
      data: polls,
      error
    } = await db
      .from('bureau_polls')
      .select('*')
      .eq('active', true)
      .order(
        'created_at',
        {
          ascending:false
        }
      );


    if(error){

      throw error;

    }


    const list =
      polls || [];


    let html = `

      <h2>
        📊 Sondages du bureau
      </h2>

    `;


    if(!list.length){

      html += `

        <div
          class="card"
          style="margin-top:15px;text-align:center;"
        >

          📭 Aucun sondage actuellement disponible.

        </div>

      `;

    }else{

      for(const poll of list){

        html += `

          <div
            class="card"
            style="
              margin-top:15px;
              padding:18px;
            "
          >

            <h3>
              📊 ${esc(
                poll.title ||
                'Sondage du bureau'
              )}
            </h3>

            ${
              poll.description
                ? `
                  <p class="muted">
                    ${esc(poll.description)}
                  </p>
                `
                : ''
            }

            <button
              type="button"
              class="primary"
              style="margin-top:10px;"
              onclick="
                openBureauPoll('${poll.id}');
              "
            >
              📝 Répondre
            </button>

          </div>

        `;

      }

    }


    html += `

      <div
        style="
          display:flex;
          justify-content:center;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR SONDAGES BUREAU MEMBRE :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger les sondages du bureau.'
    );

  }

}


/* =========================================================
   📧 NOTIFICATION EMAIL ADMIN
   ========================================================= */

async function sendAdminEmailNotification(
  type,
  title,
  message,
  sender
){
  // Envoi d'e-mails désactivé pour le clone de Bailleul.
  // Les notifications internes et push restent actives.
  console.info('Notification e-mail ignorée (fonction désactivée).', type || '');
  return false;
}

async function showMemberProfile(){

  if(!member?.id){

    alert('Aucun membre connecté.');

    return;

  }


  try{

    const {
      data:profile,
      error:profileError
    } = await db
      .from('members')
      .select(`
        id,
        first_name,
        last_name,
        birth_date,
        gender,
        sp_entry_date,
        status,
        was_jsp,
        bureau_member,
        children_count,
        role
      `)
      .eq('id',member.id)
      .single();


    if(profileError){

      throw profileError;

    }


    const {
      data:children,
      error:childrenError
    } = await db
      .from('member_children')
      .select(`
        first_name,
        last_name,
        gender,
        birth_date
      `)
      .eq('member_id',member.id)
      .order('birth_date',{
        ascending:true
      });


    if(childrenError){

      throw childrenError;

    }


    const {
      data:inactivities,
      error:inactivityError
    } = await db
      .from('member_inactivity')
      .select(`
        start_date,
        end_date
      `)
      .eq('member_id',member.id)
      .order('start_date',{
        ascending:true
      });


    if(inactivityError){

      throw inactivityError;

    }


    const fmt =
      value => {

        if(!value){

          return 'Non renseigné';

        }

        if(typeof fmtDate === 'function'){

          return fmtDate(value);

        }

        return new Date(value)
          .toLocaleDateString('fr-FR');

      };


    openModal(`

      <div>

        <div
          style="
            display:flex;
            align-items:center;
            gap:14px;
            margin-bottom:20px;
          "
        >

          <img
            src="assets/ecusson.png"
            alt="Écusson"
            style="
              width:70px;
              height:70px;
              object-fit:contain;
            "
          >

          <div>

            <h2 style="margin:0;">
              👤 Mon profil
            </h2>

            <p
              class="muted"
              style="margin:4px 0 0;"
            >
              Informations enregistrées dans votre fiche membre
            </p>

          </div>

        </div>


        <div class="card">

          <h3>
            👤 Informations personnelles
          </h3>

          <p>
            <strong>Prénom :</strong>
            ${esc(profile.first_name || 'Non renseigné')}
          </p>

          <p>
            <strong>Nom :</strong>
            ${esc(profile.last_name || 'Non renseigné')}
          </p>

          <p>
            <strong>Date de naissance :</strong>
            ${fmt(profile.birth_date)}
          </p>

          <p>
            <strong>Sexe :</strong>
            ${
              profile.gender
                ? esc(profile.gender)
                : 'Non renseigné'
            }
          </p>

        </div>


        <div class="card">

          <h3>
            🚒 Parcours Sapeur-Pompier
          </h3>

          <p>
            <strong>Date d'entrée :</strong>
            ${fmt(profile.sp_entry_date)}
          </p>

          <p>
            <strong>Statut :</strong>
            ${
              profile.status
                ? esc(profile.status)
                : 'Non renseigné'
            }
          </p>

          <p>
            <strong>Ancien JSP :</strong>
            ${profile.was_jsp ? '✅ Oui' : '❌ Non'}
          </p>

          <p>
            <strong>Membre du bureau :</strong>
            ${profile.bureau_member ? '✅ Oui' : '❌ Non'}
          </p>

          <p>
            <strong>Rôle :</strong>
            ${
              profile.role === 'admin'
                ? 'Administrateur'
                : 'Membre'
            }
          </p>

        </div>


        <div class="card">

          <h3>
            👨‍👩‍👧‍👦 Enfants
          </h3>

          <p>
            <strong>Nombre :</strong>
            ${
              Number(
                profile.children_count ||
                (children || []).length ||
                0
              )
            }
          </p>


          ${
            children?.length

              ? children.map(
                  (child,index) => `

                    <div
                      style="
                        padding:12px;
                        margin-top:10px;
                        border-radius:12px;
                        background:#f5f5f5;
                      "
                    >

                      <strong>
                        Enfant ${index + 1}
                      </strong>

                      <p>
                        Prénom :
                        ${esc(child.first_name || 'Non renseigné')}
                      </p>

                      <p>
                        Nom :
                        ${esc(child.last_name || 'Non renseigné')}
                      </p>

                      <p>
                        Sexe :
                        ${
                          child.gender
                            ? esc(child.gender)
                            : 'Non renseigné'
                        }
                      </p>

                      <p>
                        Date de naissance :
                        ${fmt(child.birth_date)}
                      </p>

                    </div>

                  `
                ).join('')

              : `
                <p class="muted">
                  Aucun enfant renseigné.
                </p>
              `
          }

        </div>


        <div class="card">

          <h3>
            ⏸️ Périodes d'inactivité
          </h3>


          ${
            inactivities?.length

              ? inactivities.map(
                  (period,index) => `

                    <div
                      style="
                        padding:12px;
                        margin-top:10px;
                        border-radius:12px;
                        background:#f5f5f5;
                      "
                    >

                      <strong>
                        Période ${index + 1}
                      </strong>

                      <p>
                        ${fmt(period.start_date)}
                        →
                        ${
                          period.end_date
                            ? fmt(period.end_date)
                            : 'En cours'
                        }
                      </p>

                    </div>

                  `
                ).join('')

              : `
                <p class="muted">
                  Aucune période d'inactivité renseignée.
                </p>
              `
          }

        </div>


        <div
          class="row"
          style="
            justify-content:flex-end;
            margin-top:18px;
          "
        >

          <button
            type="button"
            class="ghost"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR PROFIL MEMBRE :',
      error
    );

    alert(
      'Impossible de charger votre profil.'
    );

  }

}


window.showMemberProfile =
  showMemberProfile;

async function openUserBureauPolls(){

  if(
    !member ||
    member?.bureau_member !== true
  ){

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;

  }


  try{

    const {
      data: polls,
      error
    } = await db
      .from('bureau_polls')
      .select('*')
      .eq('active', true)
      .order(
        'created_at',
        {
          ascending:false
        }
      );


    if(error)
      throw error;


    const list =
      polls || [];


    const html = `

      <h2>
        📝 Sondages du bureau
      </h2>

      <p class="muted">

        Sondages réservés aux membres
        du bureau de l'amicale.

      </p>


      ${
        list.length

          ? list.map(
              poll => `

                <div
                  class="card"
                  style="
                    cursor:pointer;
                    margin-top:12px;
                  "
                  onclick="
                    openBureauPoll('${poll.id}');
                  "
                >

                  <h3>

                    📝 ${esc(
                      poll.title ||
                      'Sondage du bureau'
                    )}

                  </h3>


                  ${
                    poll.description

                      ? `

                        <p class="muted">

                          ${esc(
                            poll.description
                          )}

                        </p>

                      `

                      : ''
                  }


                  <button
                    type="button"
                    class="primary"
                    onclick="
                      event.stopPropagation();
                      openBureauPoll('${poll.id}');
                    "
                  >

                    🗳️ Répondre

                  </button>

                </div>

              `
            ).join('')

          : `

              <div
                class="card"
                style="
                  text-align:center;
                  padding:30px;
                "
              >

                <div
                  style="
                    font-size:40px;
                  "
                >
                  📝
                </div>

                <strong>
                  Aucun sondage en cours
                </strong>

                <p class="muted">

                  Aucun sondage réservé au bureau
                  n'est actuellement ouvert.

                </p>

              </div>

            `
      }


      <div
        style="
          margin-top:18px;
          text-align:right;
        "
      >

        <button
          type="button"
          class="ghost"
       onclick="
  closeAdminPopup();
"
        >

          Fermer

        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR SONDAGES BUREAU MEMBRE :',
      error
    );


    alert(
      '❌ Impossible de charger les sondages du bureau.'
    );

  }

}


// =========================================================
// 📄 DOCUMENTS DE TRAVAIL — CÔTÉ MEMBRE DU BUREAU
// =========================================================

async function showBureauWorkDocuments(){

  if(
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ){

    alert(
      '❌ Cette fonctionnalité est réservée aux membres du bureau.'
    );

    return;
  }


  try{

    const { data, error } = await db
      .from('bureau_work_documents')
      .select('*')
      .order('created_at', {
        ascending: false
      });


    if(error){

      console.error(
        'ERREUR CHARGEMENT DOCUMENTS BUREAU :',
        error
      );

      alert(
        '❌ Impossible de charger les documents.'
      );

      return;
    }


    const documents = data || [];


    openModal(`

      <h2>
        📄 Documents de travail du bureau
      </h2>

      <p class="muted">
        Consultez les documents de travail et
        ajoutez vos actions.
      </p>


      <div style="margin-top:18px;">

        ${
          documents.length

          ? documents.map(d => `

              <div
                class="card"
                style="
                  margin-bottom:12px;
                  padding:15px;
                "
              >

                <h3 style="margin:0 0 6px 0;">
                  📄 ${esc(d.title)}
                </h3>

                ${
                  d.description
                    ? `
                      <p
                        class="muted"
                        style="margin:0 0 12px 0;"
                      >
                        ${esc(d.description)}
                      </p>
                    `
                    : ''
                }

                <button
                  type="button"
                  class="primary"
                  onclick="openBureauWorkDocument('${d.id}')"
                >
                  📂 Ouvrir le document
                </button>

              </div>

            `).join('')

          : `

              <div class="card">

                <p
                  class="muted"
                  style="margin:0;"
                >
                  📭 Aucun document de travail n'a encore été créé.
                </p>

              </div>

            `
        }

      </div>


      <div
        class="row"
        style="
          justify-content:flex-end;
          margin-top:18px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR SHOW BUREAU WORK DOCUMENTS :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


window.showBureauWorkDocuments =
  showBureauWorkDocuments;




// ==========================================================
// 🗣️ AJOUTER UN SUJET À ABORDER EN RÉUNION
// ==========================================================

function showMeetingSubjectForm(){

  // 🔒 Réservé aux membres du bureau et aux administrateurs
  if(
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ){

    alert(
      '❌ Cette fonction est réservée aux membres du bureau.'
    );

    return;

  }

  openModal(`

    <h2>
      🗣️ Ajouter un sujet à aborder
    </h2>

    <p class="muted">
      Proposez un sujet que vous souhaitez voir abordé
      lors d'une prochaine réunion.
    </p>


    <div
      class="card"
      style="margin-top:15px;"
    >

      <label>
        <strong>
          Sujet
        </strong>
      </label>

      <input
        type="text"
        id="meetingSubjectTitle"
        placeholder="Ex : Achat de nouveau matériel"
        maxlength="150"
        style="
          width:100%;
          margin-top:8px;
        "
      >


      <label
        style="
          display:block;
          margin-top:15px;
        "
      >

        <strong>
          Description
        </strong>

      </label>

      <textarea
        id="meetingSubjectDescription"
        placeholder="Expliquez brièvement le sujet à aborder..."
        maxlength="1000"
        rows="5"
        style="
          width:100%;
          margin-top:8px;
          resize:vertical;
        "
      ></textarea>

    </div>


    <div
      class="row"
      style="
        margin-top:20px;
        justify-content:flex-end;
        gap:10px;
      "
    >

      <button
        type="button"
        class="ghost"
        onclick="closeModal()"
      >
        Annuler
      </button>

      <button
        type="button"
        class="primary"
        onclick="submitMeetingSubject()"
      >
        📨 Envoyer le sujet
      </button>

    </div>

  `);

}


window.showMeetingSubjectForm =
  showMeetingSubjectForm;

// ==========================================================
// 🗣️ ENREGISTRER UN SUJET À ABORDER EN RÉUNION
// ==========================================================

async function submitMeetingSubject(){

  try{

    // --------------------------------------------------------
    // 🔐 Vérification membre
    // --------------------------------------------------------

    if(
      !member ||
      (
        member.bureau_member !== true &&
        member.role !== 'admin'
      )
    ){

      alert(
        '❌ Cette fonctionnalité est réservée aux membres de l’Amicale.'
      );

      return;

    }


    // --------------------------------------------------------
    // 📝 Récupération des champs
    // --------------------------------------------------------

    const title =
      document
        .getElementById('meetingSubjectTitle')
        ?.value
        ?.trim();


    const description =
      document
        .getElementById('meetingSubjectDescription')
        ?.value
        ?.trim();


    // --------------------------------------------------------
    // ⚠️ Vérification
    // --------------------------------------------------------

    if(!title){

      alert(
        '⚠️ Veuillez renseigner le sujet à aborder.'
      );

      return;

    }


    // --------------------------------------------------------
    // 💾 Enregistrement Supabase
    // --------------------------------------------------------

    const { data, error } =
      await db
        .from('meeting_subjects')
        .insert({

          member_id:
            member.id,

          title:
            title,

          description:
            description || null,

          status:
            'a_aborder'

        })
        .select()
        .maybeSingle();


    // --------------------------------------------------------
    // ❌ Erreur
    // --------------------------------------------------------

    if(error){

      console.error(
        'ERREUR AJOUT SUJET RÉUNION :',
        error
      );

      alert(
        '❌ Impossible d’enregistrer le sujet.\n\n' +
        (
          error.message ||
          'Erreur inconnue'
        )
      );

      return;

    }
sendAdminEmailNotification(
  'meeting_subject',
  '🆕 Nouveau sujet à aborder',
  `Sujet : ${title}\n\n${description || 'Aucune description.'}`,
  `${member.first_name || ''} ${member.last_name || ''}`.trim()
);

    // --------------------------------------------------------
    // ✅ Succès
    // --------------------------------------------------------

    closeModal();


    alert(
      '✅ Sujet ajouté avec succès !\n\n' +
      'Il pourra être abordé lors d’une prochaine réunion.'
    );


  }catch(error){

    console.error(
      'ERREUR SUBMIT MEETING SUBJECT :',
      error
    );

    alert(
      '❌ Une erreur est survenue lors de l’enregistrement.'
    );

  }

}


window.submitMeetingSubject =
  submitMeetingSubject;



// ============================================================
// 📋 OUVRIR LA LISTE DES COMPTES RENDUS
// ============================================================

async function showUserMeetingReports(){

  const {data:reports,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .order(
        'meeting_date',
        {ascending:false}
      );


  if(error){

    console.error(
      'Erreur chargement comptes rendus :',
      error
    );

    alert(
      '❌ Impossible de charger les comptes rendus.'
    );

    return;

  }


  openModal(`

    <h2>
      📋 Comptes rendus de réunion
    </h2>


    ${
      reports && reports.length

      ? `

        <div>

          ${reports.map(report => {

            const type =
              report.meeting_type ===
              'assemblee_generale'

                ? '🟣 Assemblée générale'

                : '🔵 Réunion amicale';


            const date =
              report.meeting_date

                ? new Date(
                    report.meeting_date +
                    'T00:00:00'
                  ).toLocaleDateString(
                    'fr-FR'
                  )

                : 'Date non renseignée';


            return `

              <button
                type="button"
                style="
                  width:100%;
                  text-align:left;
                  margin-bottom:10px;
                  padding:15px;
                  border-radius:10px;
                  border:1px solid #ddd;
                  background:var(--card-bg,#fff);
                  cursor:pointer;
                "
                onclick="
                  viewUserMeetingReport(
                    '${report.id}'
                  );
                "
              >

                <strong>

                  ${type}

                </strong>


                <br>


                <span
                  class="muted"
                >

                  📅 ${date}

                </span>


                <br>


                <strong>

                  📝 ${esc(
                    report.title || ''
                  )}

                </strong>

              </button>

            `;

          }).join('')}

        </div>

      `

      : `

        <div class="card">

          <p class="muted">

            Aucun compte rendu disponible.

          </p>

        </div>

      `

    }


    <div
      class="row"
      style="
        margin-top:15px;
      "
    >

      <button
        type="button"
        class="secondary"
        onclick="closeModal()"
      >

        Fermer

      </button>

    </div>

  `);

}


window.showUserMeetingReports =
  showUserMeetingReports;


// ============================================================
// 📋 COMPTES RENDUS - UTILISATEUR
// ============================================================

async function loadUserMeetingReports(){

  const container =
    $('userMeetingReportsList');

  if(!container) return;


  const {data:reports,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .order(
        'meeting_date',
        {ascending:false}
      );


  if(error){

    console.error(
      'Erreur chargement comptes rendus utilisateur :',
      error
    );

    container.innerHTML = `

      <p style="color:#c1121f;">

        ❌ Impossible de charger
        les comptes rendus.

      </p>

    `;

    return;

  }


  if(!reports || !reports.length){

    container.innerHTML = `

      <div class="card">

        <p class="muted">

          Aucun compte rendu disponible.

        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =

    reports.map(report => {

      const type =

        report.meeting_type ===
        'assemblee_generale'

        ? '🟣 ASSEMBLÉE GÉNÉRALE'

        : '🔵 RÉUNION AMICALE';


      const date =

        report.meeting_date

        ? new Date(
            report.meeting_date +
            'T00:00:00'
          ).toLocaleDateString(
            'fr-FR'
          )

        : 'Date non renseignée';


      const borderColor =

        report.meeting_type ===
        'assemblee_generale'

        ? '#7b2cbf'

        : '#2563eb';


      return `

        <div
          class="card"
          style="
            margin-bottom:12px;
            border-left:4px solid
              ${borderColor};
          "
        >

          <h3
            style="
              margin-top:0;
              margin-bottom:8px;
            "
          >

            ${type}

          </h3>


          <p style="margin:5px 0;">

            📅

            <strong>

              ${date}

            </strong>

          </p>


          <p style="margin:5px 0;">

            📝

            <strong>

              ${esc(report.title || '')}

            </strong>

          </p>


          <button
            type="button"
            class="primary"
            style="margin-top:10px;"
            onclick="
              viewUserMeetingReport(
                '${report.id}'
              );
            "
          >

            📋 Voir le compte rendu

          </button>

        </div>

      `;

    }).join('');

}


window.loadUserMeetingReports =
  loadUserMeetingReports;

// ============================================================
// 👁️ VOIR UN COMPTE RENDU - UTILISATEUR
// ============================================================

async function viewUserMeetingReport(id){

  const {data:report,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .eq('id',id)
      .single();


  if(error || !report){

    console.error(error);

    alert(
      '❌ Impossible de récupérer le compte rendu.'
    );

    return;

  }


  const {data:topics,error:topicsError} =
    await db
      .from('meeting_report_topics')
      .select('*')
      .eq('report_id',id)
      .order(
        'topic_order',
        {ascending:true}
      );


  if(topicsError){

    console.error(topicsError);

    alert(
      '❌ Impossible de récupérer les thèmes.'
    );

    return;

  }


  const type =

    report.meeting_type ===
    'assemblee_generale'

      ? '🟣 ASSEMBLÉE GÉNÉRALE'

      : '🔵 RÉUNION AMICALE';


  const date =

    report.meeting_date

      ? new Date(
          report.meeting_date +
          'T00:00:00'
        ).toLocaleDateString(
          'fr-FR'
        )

      : 'Date non renseignée';


  openModal(`

    <h2>

      📋 Compte rendu

    </h2>


    <div
      class="card"
      style="
        margin-bottom:15px;
      "
    >

      <h3>

        ${type}

      </h3>


      <p>

        📅

        <strong>

          ${date}

        </strong>

      </p>


      <p>

        📝

        <strong>

          ${esc(report.title || '')}

        </strong>

      </p>

    </div>


    ${
      topics && topics.length

      ? topics.map((topic,index) => `

          <div
            class="card"
            style="
              margin-bottom:12px;
              page-break-inside:avoid;
            "
          >

            <h3>

              📌

              ${index + 1}.

              ${esc(
                topic.topic ||
                'Thème'
              )}

            </h3>


            <div
              style="
                white-space:pre-wrap;
                line-height:1.6;
              "
            >

              ${esc(
                topic.content || ''
              )}

            </div>

          </div>

        `).join('')

      : `

        <div class="card">

          <p class="muted">

            Aucun thème renseigné.

          </p>

        </div>

      `

    }


    <div
      class="row"
      style="
        margin-top:20px;
        gap:10px;
        flex-wrap:wrap;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="
          printMeetingReport(
            '${report.id}'
          );
        "
      >

        🖨️ Imprimer

      </button>


      <button
        type="button"
        class="secondary"
        onclick="closeModal()"
      >

        Fermer

      </button>

    </div>

  `);

}


window.viewUserMeetingReport =
  viewUserMeetingReport;




// ============================================================
// 🏅 APERÇU DES MÉDAILLES DU MEMBRE
// ============================================================

async function showMyMedals(){

  try{

    if(!member?.id){

      alert('Vous devez être connecté.');
      return;

    }


    // ============================================================
    // RÉCUPÉRATION DU MEMBRE
    // ============================================================

    const {
      data: currentMember,
      error: memberError
    } = await db
      .from('members')
      .select('*')
      .eq('id', member.id)
      .single();

    if(memberError) throw memberError;


    if(!currentMember.sp_entry_date){

      openModal(`

        <div style="
          max-width:700px;
          margin:auto;
        ">

          <div style="
            text-align:center;
            padding:30px 20px;
          ">

            <div style="
              font-size:55px;
              margin-bottom:10px;
            ">
              🏅
            </div>

            <h2 style="
              margin:0 0 8px;
              font-size:25px;
            ">
              Mes médailles
            </h2>

            <p class="muted">
              Votre parcours d'engagement
            </p>

          </div>


          <div class="card" style="
            padding:25px;
            text-align:center;
            border-radius:18px;
          ">

            <div style="
              font-size:42px;
              margin-bottom:10px;
            ">
              ⚠️
            </div>

            <h3>
              Date d'engagement non renseignée
            </h3>

            <p class="muted">
              Votre date de début d'engagement
              n'a pas encore été renseignée.
            </p>

            <p class="muted">
              Contactez l'administrateur pour
              mettre vos informations à jour.
            </p>

          </div>


          <div style="
            text-align:center;
            margin-top:20px;
          ">

            <button
              class="primary"
              onclick="closeModal()"
            >
              Fermer
            </button>

          </div>

        </div>

      `);

      return;

    }


    // ============================================================
    // PÉRIODES D'INACTIVITÉ
    // ============================================================

    const {
      data: inactivities,
      error: inactivityError
    } = await db
      .from('member_inactivity')
      .select('*')
      .eq('member_id',member.id);

    if(inactivityError) throw inactivityError;

    const inactivityList = inactivities || [];


    // ============================================================
    // DATES
    // ============================================================

    const today = new Date();

    const entry = new Date(
      currentMember.sp_entry_date
    );

    if(isNaN(entry.getTime())){

      throw new Error(
        'La date d’engagement enregistrée est invalide.'
      );

    }


    // ============================================================
    // CALCUL ANCIENNETÉ
    // ============================================================

    function calculateEngagement(){

      let cursor = new Date(entry);
      const now = new Date(today);

      let years =
        now.getFullYear() -
        cursor.getFullYear();

      let months =
        now.getMonth() -
        cursor.getMonth();

      let days =
        now.getDate() -
        cursor.getDate();


      if(days < 0){

        months--;

        const previousMonth =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            0
          );

        days += previousMonth.getDate();

      }


      if(months < 0){

        years--;

        months += 12;

      }


      // ----------------------------------------------------------
      // RETRAIT DES INACTIVITÉS
      // ----------------------------------------------------------

      inactivityList.forEach(i=>{

        if(!i.start_date) return;

        const start =
          new Date(i.start_date);

        let end =
          i.end_date
            ? new Date(i.end_date)
            : new Date(today);


        if(isNaN(start.getTime())) return;

        if(isNaN(end.getTime())){

          end = new Date(today);

        }


        if(start < entry){

          start.setTime(
            entry.getTime()
          );

        }


        if(end > today){

          end = new Date(today);

        }


        if(end <= start) return;


        let inactiveYears =
          end.getFullYear() -
          start.getFullYear();

        let inactiveMonths =
          end.getMonth() -
          start.getMonth();

        let inactiveDays =
          end.getDate() -
          start.getDate();


        if(inactiveDays < 0){

          inactiveMonths--;

          const previousMonth =
            new Date(
              end.getFullYear(),
              end.getMonth(),
              0
            );

          inactiveDays +=
            previousMonth.getDate();

        }


        if(inactiveMonths < 0){

          inactiveYears--;

          inactiveMonths += 12;

        }


        years -= inactiveYears;
        months -= inactiveMonths;
        days -= inactiveDays;


        if(days < 0){

          days += 30;
          months--;

        }


        if(months < 0){

          months += 12;
          years--;

        }

      });


      return {

        years:Math.max(0,years),
        months:Math.max(0,months),
        days:Math.max(0,days)

      };

    }


    const engagement =
      calculateEngagement();


    // ============================================================
    // MÉDAILLES
    // ============================================================

    const federation = [

      {
        months:120,
        name:'Bronze',
        emoji:'🥉'
      },

      {
        months:240,
        name:'Argent',
        emoji:'🥈'
      },

      {
        months:360,
        name:'Or',
        emoji:'🥇'
      }

    ];


    const union = [

      {
        months:84,
        name:'Cuivre',
        emoji:'🟤'
      },

      {
        months:180,
        name:'Bronze',
        emoji:'🥉'
      },

      {
        months:240,
        name:'Argent',
        emoji:'🥈'
      },

      {
        months:360,
        name:'Or',
        emoji:'🥇'
      }

    ];


    // ============================================================
    // ANCIENNETÉ POUR LES MÉDAILLES
    // ============================================================

    let seniorityMonths =
      engagement.years * 12 +
      engagement.months;


    // Ancien JSP : +12 mois uniquement
    // pour le calcul des médailles

    if(currentMember.was_jsp === true){

      seniorityMonths += 12;

    }


    // ============================================================
    // DATES DES MÉDAILLES
    // ============================================================

    function getMedalDate(medal){

      if(
        !currentMember ||
        !currentMember.sp_entry_date ||
        !medal
      ){

        return null;

      }


      const medalDate =
        new Date(
          currentMember.sp_entry_date
        );


      if(isNaN(medalDate.getTime())){

        return null;

      }


      // Date normale

      medalDate.setMonth(
        medalDate.getMonth() +
        medal.months
      );


      // Ancien JSP
      // Avance uniquement la date

      if(currentMember.was_jsp === true){

        medalDate.setMonth(
          medalDate.getMonth() - 12
        );

      }


      // ----------------------------------------------------------
      // INACTIVITÉS
      // ----------------------------------------------------------

      inactivityList.forEach(i=>{

        if(
          !i?.start_date ||
          String(i.member_id) !==
          String(member.id)
        ){

          return;

        }


        let start =
          new Date(i.start_date);

        let end =
          i.end_date
            ? new Date(i.end_date)
            : new Date(today);


        if(isNaN(start.getTime())) return;


        if(isNaN(end.getTime())){

          end = new Date(today);

        }


        if(start < entry){

          start = new Date(entry);

        }


        if(start >= today){

          return;

        }


        if(end > today){

          end = new Date(today);

        }


        if(end <= start){

          return;

        }


        let inactiveMonths =
          (
            end.getFullYear() -
            start.getFullYear()
          ) * 12
          +
          (
            end.getMonth() -
            start.getMonth()
          );


        if(
          end.getDate() <
          start.getDate()
        ){

          inactiveMonths--;

        }


        inactiveMonths =
          Math.max(
            0,
            inactiveMonths
          );


        medalDate.setMonth(
          medalDate.getMonth() +
          inactiveMonths
        );

      });


      return medalDate;

    }


    // ============================================================
    // MÉDAILLES OBTENUES
    // ============================================================

    const federationObtained =
      federation.filter(
        m => seniorityMonths >= m.months
      );


    const unionObtained =
      union.filter(
        m => seniorityMonths >= m.months
      );


    // ============================================================
    // PROCHAINES MÉDAILLES
    // ============================================================

    const nextFederation =
      federation.find(
        m => seniorityMonths < m.months
      );


    const nextUnion =
      union.find(
        m => seniorityMonths < m.months
      );


    // ============================================================
    // TEMPS RESTANT
    // ============================================================

    function formatRemaining(targetDate){

      if(!targetDate){

        return '—';

      }


      const target =
        new Date(targetDate);


      if(target <= today){

        return 'Dès maintenant';

      }


      let years =
        target.getFullYear() -
        today.getFullYear();

      let months =
        target.getMonth() -
        today.getMonth();

      let days =
        target.getDate() -
        today.getDate();


      if(days < 0){

        months--;

        const previousMonth =
          new Date(
            target.getFullYear(),
            target.getMonth(),
            0
          );

        days +=
          previousMonth.getDate();

      }


      if(months < 0){

        years--;

        months += 12;

      }


      const parts = [];


      if(years > 0){

        parts.push(
          `${years} an${years > 1 ? 's' : ''}`
        );

      }


      if(months > 0){

        parts.push(
          `${months} mois`
        );

      }


      if(days > 0){

        parts.push(
          `${days} jour${days > 1 ? 's' : ''}`
        );

      }


      return parts.length
        ? parts.join(' ')
        : 'Moins d’un jour';

    }


    // ============================================================
    // CARTE D'UNE MÉDAILLE
    // ============================================================

    function medalCard(medal,obtained,type){

      const medalDate =
        obtained
          ? getMedalDate(medal)
          : null;


      const color =
        medal.name === 'Or'
          ? '#d4a017'
          : medal.name === 'Argent'
            ? '#8b95a5'
            : medal.name === 'Bronze'
              ? '#a9683b'
              : '#9a7b35';


      const bg =
        obtained
          ? `linear-gradient(135deg,${color}18,${color}08)`
          : '#f7f8fa';


      return `

        <div
          style="
            position:relative;
            display:flex;
            align-items:center;
            gap:15px;
            padding:18px;
            margin-top:10px;
            border-radius:18px;
            background:${bg};
            border:1px solid ${obtained ? color+'55' : '#e5e7eb'};
            box-shadow:${obtained
              ? '0 4px 15px rgba(0,0,0,.05)'
              : 'none'};
            opacity:${obtained ? '1' : '.55'};
          "
        >

          <div style="
            width:58px;
            height:58px;
            min-width:58px;
            border-radius:50%;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:32px;
            background:${obtained ? '#fff' : '#eceff3'};
            box-shadow:0 2px 8px rgba(0,0,0,.08);
          ">
            ${obtained ? medal.emoji : '🔒'}
          </div>


          <div style="
            flex:1;
            min-width:0;
          ">

            <div style="
              font-size:17px;
              font-weight:800;
              color:${obtained ? '#182033' : '#687386'};
            ">
              Médaille ${esc(medal.name)}
            </div>


            <div style="
              margin-top:5px;
              font-size:13px;
              color:#6b7280;
            ">

              ${
                obtained

                  ? `📅 Obtenue en ${
                      medalDate
                        ? medalDate.getFullYear()
                        : '—'
                    }`

                  : `⏳ ${medal.months / 12} ${
                      medal.months / 12 > 1
                        ? 'ans'
                        : 'an'
                    } d'ancienneté`

              }

            </div>

          </div>


          ${
            obtained

              ? `

                <div style="
                  font-size:12px;
                  font-weight:800;
                  padding:6px 10px;
                  border-radius:20px;
                  background:${color}22;
                  color:${color};
                ">
                  ✓ OBTENUE
                </div>

              `

              : ''

          }

        </div>

      `;

    }


    // ============================================================
    // PROGRESSION
    // ============================================================

    function progressCard(next,type){

      if(!next){

        return `

          <div style="
            margin-top:15px;
            padding:18px;
            border-radius:18px;
            background:linear-gradient(
              135deg,
              #fef3c7,
              #fff
            );
            border:1px solid #f1d47a;
          ">

            <div style="
              font-size:15px;
              font-weight:800;
            ">
              🏆 Toutes les médailles sont obtenues
            </div>

            <div class="muted"
                 style="margin-top:5px;">
              Félicitations pour votre parcours !
            </div>

          </div>

        `;

      }


      const previousList =
        type === 'federation'
          ? federation
          : union;


      const previous =
        [...previousList]
          .reverse()
          .find(
            m => m.months < next.months
          );


      const start =
        previous
          ? previous.months
          : 0;


      const total =
        next.months - start;


      const current =
        Math.max(
          0,
          seniorityMonths - start
        );


      const percentage =
        Math.min(
          100,
          Math.max(
            0,
            (current / total) * 100
          )
        );


      return `

        <div style="
          margin-top:15px;
          padding:20px;
          border-radius:20px;
          background:#fff;
          border:1px solid #e5e7eb;
          box-shadow:0 3px 12px rgba(0,0,0,.04);
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
          ">

            <div>

              <div style="
                font-size:12px;
                text-transform:uppercase;
                font-weight:800;
                opacity:.6;
              ">
                Prochaine médaille
              </div>

              <div style="
                font-size:20px;
                font-weight:800;
                margin-top:4px;
              ">
                ${next.emoji}
                ${esc(next.name)}
              </div>

            </div>


            <div style="
              text-align:right;
            ">

              <div style="
                font-size:12px;
                opacity:.6;
              ">
                Encore
              </div>

              <strong style="
                font-size:15px;
              ">
                ${formatRemaining(
                  getMedalDate(next)
                )}
              </strong>

            </div>

          </div>


          <div style="
            height:10px;
            background:#e9edf3;
            border-radius:20px;
            overflow:hidden;
            margin-top:18px;
          ">

            <div style="
              width:${percentage}%;
              height:100%;
              border-radius:20px;
              background:linear-gradient(
                90deg,
                #2563eb,
                #60a5fa
              );
              transition:width .4s ease;
            "></div>

          </div>


          <div style="
            display:flex;
            justify-content:space-between;
            margin-top:7px;
            font-size:12px;
            opacity:.6;
          ">

            <span>
              ${Math.round(percentage)} %
            </span>

            <span>
              ${next.months} mois
            </span>

          </div>

        </div>

      `;

    }


    // ============================================================
    // HTML FÉDÉRATION
    // ============================================================

    const federationHtml = `

      <div style="
        margin-top:15px;
      ">

        ${
          federation.map(
            medal =>
              medalCard(
                medal,
                seniorityMonths >= medal.months,
                'federation'
              )
          ).join('')
        }

      </div>


      ${progressCard(
        nextFederation,
        'federation'
      )}

    `;


    // ============================================================
    // HTML UNION
    // ============================================================

    const unionHtml = `

      <div style="
        margin-top:15px;
      ">

        ${
          union.map(
            medal =>
              medalCard(
                medal,
                seniorityMonths >= medal.months,
                'union'
              )
          ).join('')
        }

      </div>


      ${progressCard(
        nextUnion,
        'union'
      )}

    `;


    // ============================================================
    // AFFICHAGE FINAL
    // ============================================================

    openModal(`

      <div style="
        max-width:720px;
        margin:auto;
        padding-bottom:10px;
      ">


        <!-- =====================================================
             EN-TÊTE
        ====================================================== -->

        <div style="
          text-align:center;
          padding:12px 5px 22px;
        ">

          <div style="
            font-size:48px;
            margin-bottom:5px;
          ">
            🏅
          </div>

          <h2 style="
            margin:0;
            font-size:28px;
          ">
            Mes médailles
          </h2>

          <p class="muted"
             style="
               margin:7px 0 0;
             ">
            Votre parcours d'engagement
          </p>

        </div>


        <!-- =====================================================
             GRANDE CARTE ANCIENNETÉ
        ====================================================== -->

        <div style="
          position:relative;
          overflow:hidden;
          border-radius:24px;
          padding:25px 20px;
          color:white;
          background:
            linear-gradient(
              135deg,
              #172554,
              #1d4ed8
            );
          box-shadow:
            0 10px 30px rgba(29,78,216,.22);
          text-align:center;
        ">

          <div style="
            position:absolute;
            width:150px;
            height:150px;
            border-radius:50%;
            background:rgba(255,255,255,.08);
            right:-50px;
            top:-50px;
          "></div>


          <div style="
            position:absolute;
            width:100px;
            height:100px;
            border-radius:50%;
            background:rgba(255,255,255,.06);
            left:-35px;
            bottom:-35px;
          "></div>


          <div style="
            position:relative;
            font-size:14px;
            opacity:.85;
          ">
            🎉 Bravo ${esc(
              currentMember.first_name || ''
            )} !
          </div>


          <div style="
            position:relative;
            margin-top:10px;
            font-size:27px;
            font-weight:900;
          ">

            ${engagement.years}
            <span style="
              font-size:15px;
              font-weight:600;
              opacity:.8;
            ">
              an${engagement.years > 1 ? 's' : ''}
            </span>

            ${engagement.months}
            <span style="
              font-size:15px;
              font-weight:600;
              opacity:.8;
            ">
              mois
            </span>

            ${engagement.days}
            <span style="
              font-size:15px;
              font-weight:600;
              opacity:.8;
            ">
              jour${engagement.days > 1 ? 's' : ''}
            </span>

          </div>


          <div style="
            position:relative;
            margin-top:5px;
            font-size:13px;
            opacity:.8;
          ">
            d'engagement réel
          </div>

        </div>


        <!-- =====================================================
             INFOS
        ====================================================== -->

        <div style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:10px;
          margin-top:12px;
        ">


          <div class="card"
               style="
                 padding:15px;
                 border-radius:18px;
               ">

            <div style="
              font-size:11px;
              text-transform:uppercase;
              opacity:.55;
              font-weight:800;
            ">
              Début
            </div>

            <div style="
              margin-top:5px;
              font-weight:800;
            ">
              📅 ${fmtDate(
                currentMember.sp_entry_date
              )}
            </div>

          </div>


          <div class="card"
               style="
                 padding:15px;
                 border-radius:18px;
               ">

            <div style="
              font-size:11px;
              text-transform:uppercase;
              opacity:.55;
              font-weight:800;
            ">
              Ancienneté médailles
            </div>

            <div style="
              margin-top:5px;
              font-weight:800;
            ">
              🏅 ${seniorityMonths} mois
            </div>

          </div>


        </div>


        ${
          currentMember.was_jsp === true

            ? `

              <div style="
                margin-top:12px;
                padding:13px 16px;
                border-radius:16px;
                background:#fff7ed;
                border:1px solid #fed7aa;
                font-size:13px;
              ">

                ⭐
                <strong>Ancien JSP</strong>
                —
                +12 mois pris en compte
                pour les médailles.

              </div>

            `

            : ''

        }


        <!-- =====================================================
             FÉDÉRATION
        ====================================================== -->

        <div style="
          margin-top:25px;
        ">

          <div style="
            display:flex;
            align-items:center;
            gap:10px;
          ">

            <div style="
              width:45px;
              height:45px;
              border-radius:14px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:23px;
              background:#eff6ff;
            ">
              🏅
            </div>

            <div>

              <h3 style="
                margin:0;
                font-size:20px;
              ">
                Fédération
              </h3>

              <div class="muted"
                   style="font-size:13px;">
                Distinctions fédérales
              </div>

            </div>

          </div>


          ${federationHtml}

        </div>


        <!-- =====================================================
             UNION
        ====================================================== -->

        <div style="
          margin-top:30px;
        ">

          <div style="
            display:flex;
            align-items:center;
            gap:10px;
          ">

            <div style="
              width:45px;
              height:45px;
              border-radius:14px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:23px;
              background:#fffbeb;
            ">
              🏆
            </div>

            <div>

              <h3 style="
                margin:0;
                font-size:20px;
              ">
                Union départementale
              </h3>

              <div class="muted"
                   style="font-size:13px;">
                Distinctions départementales
              </div>

            </div>

          </div>


          ${unionHtml}

        </div>


        <!-- =====================================================
             BOUTON
        ====================================================== -->

        <div style="
          text-align:center;
          margin-top:25px;
        ">

          <button
            type="button"
            class="primary"
            onclick="closeModal()"
            style="
              min-width:150px;
            "
          >
            Fermer
          </button>

        </div>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR MES MÉDAILLES :',
      error
    );

    alert(
      error.message ||
      'Impossible de calculer vos médailles.'
    );

  }

}


// ============================================================
// EXPOSITION
// ============================================================

window.showMyMedals =
  showMyMedals;

async function showEvents(){
  try{
    const {data,error}=await db
      .from('events')
      .select('*')
      .eq('active',true)
      .eq('archived',false)
      .order('event_date',{ascending:true});

    if(error)throw error;

    const events=data||[];

    let html=`
      <h2>🎉 Festivités disponibles</h2>

      <div class="grid" style="margin-top:15px;">
    `;

    if(!events.length){

      html+=`
        <div class="card">
          <h3>🎉 Aucune festivité</h3>
          <p>Aucune festivité n'est actuellement disponible.</p>
        </div>
      `;

    }else{

      events.forEach(e=>{

        html+=`
          <div class="card event-card">

            <h3>🎉 ${esc(e.title||'Festivité')}</h3>

            ${
              e.poster_url
              ? `
                <div
                  style="
                    margin:12px 0;
                    text-align:center;
                  "
                >

                  <img
                    src="${esc(e.poster_url)}"
                    alt="Affiche - ${esc(e.title||'Festivité')}"
                    onclick="openEventPoster('${esc(e.poster_url)}','${esc(e.title||'Festivité')}')"
                    style="
                      width:100%;
                      max-height:400px;
                      object-fit:contain;
                      border-radius:12px;
                      display:block;
                      cursor:pointer;
                    "
                  >

                  <div
                    style="
                      margin-top:6px;
                      font-size:13px;
                      color:#666;
                    "
                  >
                    👆 Appuyez sur l'affiche pour l'agrandir
                  </div>

                </div>
              `
              : ''
            }

            <p>
              📅 ${fmtDate(e.event_date)}
              ${
                e.event_time
                ? ` · ${e.event_time.slice(0,5)}`
                : ''
              }
            </p>

            <p>
              📍 ${esc(e.location||'Lieu à préciser')}
            </p>

            ${
              e.description
              ? `<p>${esc(e.description)}</p>`
              : ''
            }

            <div class="actions" style="margin-top:15px;">

              <button
                type="button"
                class="primary"
                onclick="answerEvent('${e.id}')">
                📝 Répondre
              </button>

            </div>

          </div>
        `;

      });
    }

    html+=`
      </div>

      <hr style="margin:20px 0;">

      <div
        class="row"
        style="justify-content:center;gap:8px;">

        <button
          type="button"
          class="ghost"
          onclick="closeModal();showMyEventResponses();">
          📋 Voir mes réponses
        </button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()">
          Fermer
        </button>

      </div>
    `;

    openModal(html);

  }catch(error){
    console.error('ERREUR FESTIVITÉS :',error);
    alert(error.message||'Impossible de charger les festivités.');
  }
}


// ============================================================
// 🖼️ AFFICHAGE DE L'AFFICHE EN GRAND
// ============================================================

function openEventPoster(
  url,
  title='Affiche de la festivité'
){

  openModal(`
    <div
      style="
        text-align:center;
        width:100%;
      "
    >

      <h2>🖼️ ${esc(title)}</h2>

      <img
        src="${esc(url)}"
        alt="Affiche - ${esc(title)}"
        style="
          width:100%;
          max-height:80vh;
          object-fit:contain;
          border-radius:12px;
          display:block;
          cursor:zoom-out;
          background:#f5f5f5;
        "
      >

      <button
        type="button"
        class="ghost"
        onclick="closeModal()"
        style="margin-top:15px;"
      >
        Fermer
      </button>

    </div>
  `);

}

// ============================================================
// 🔔 NOTIFICATIONS UTILISATEUR
// ============================================================

async function getUserNotifications(){

  try{

    const [
      eventsRes,
      pollsRes,
      notesRes,
      publicationsRes
    ] = await Promise.all([


      /* =====================================================
         🎉 FESTIVITÉS
      ===================================================== */

      db
        .from('events')
        .select('id,title,event_date,created_at')
        .eq('active',true)
        .eq('archived',false)
        .order('created_at',{ascending:false}),


      /* =====================================================
         📊 SONDAGES
      ===================================================== */

      db
        .from('polls')
        .select('id,title,created_at')
        .eq('active',true)
        .order('created_at',{ascending:false}),


      /* =====================================================
         🏛️ NOTIFICATIONS BUREAU
      ===================================================== */

      db
        .from('admin_notes')
        .select(`
          id,
          title,
          content,
          created_at,
          recipient_type,
          recipient_member_id
        `)
        .eq('active',true)
        .order('created_at',{ascending:false}),


      /* =====================================================
         📢 PUBLICATIONS
      ===================================================== */

      db
        .from('publications')
        .select(`
          id,
          title,
          content,
          type,
          file_url,
          file_name,
          created_at,
          created_by,
          active
        `)
        .eq('active',true)
        .order('created_at',{ascending:false})

    ]);


    /* =====================================================
       VÉRIFICATION DES ERREURS
    ===================================================== */

    if(eventsRes.error)
      throw eventsRes.error;

    if(pollsRes.error)
      throw pollsRes.error;

    if(notesRes.error)
      throw notesRes.error;

    if(publicationsRes.error)
      throw publicationsRes.error;


    /* =====================================================
       RETOUR
    ===================================================== */

    return {

      events:
        eventsRes.data || [],

      polls:
        pollsRes.data || [],

      notes:
        notesRes.data || [],

      publications:
        publicationsRes.data || []

    };


  }catch(error){

    console.error(
      'ERREUR NOTIFICATIONS :',
      error
    );


    return {

      events:[],
      polls:[],
      notes:[],
      publications:[]

    };

  }

}


window.getUserNotifications =
  getUserNotifications;
// ============================================================
// 🔔 NOUVELLES NOTIFICATIONS
// ============================================================

async function updateNotificationBadge(){

  const badge =
    $('notificationBadge');

  if(!badge) return;

  try{

    const notifications =
      await getNewUserNotifications();


    if(notifications.length > 0){

      badge.style.display =
        'inline-block';

      badge.textContent =
        '🆕 NOUVELLE PUBLICATION';


      // ==================================================
      // 🔴 CLIGNOTEMENT
      // ==================================================

      if(!badge._blinkAnimation){

        badge._blinkAnimation =
          badge.animate(

            [
              {
                opacity: 1,
                transform: 'scale(1)'
              },

              {
                opacity: 0.25,
                transform: 'scale(1.05)'
              },

              {
                opacity: 1,
                transform: 'scale(1)'
              }
            ],

            {
              duration: 1000,
              iterations: Infinity
            }

          );

      }


    }else{

      badge.style.display =
        'none';

      badge.textContent =
        '';


      // Arrête le clignotement
      if(badge._blinkAnimation){

        badge._blinkAnimation.cancel();

        badge._blinkAnimation =
          null;

      }

    }


  }catch(error){

    console.error(
      'ERREUR BADGE NOTIFICATIONS :',
      error
    );

    badge.style.display =
      'none';


    if(badge._blinkAnimation){

      badge._blinkAnimation.cancel();

      badge._blinkAnimation =
        null;

    }

  }

}

window.updateNotificationBadge =
  updateNotificationBadge;

async function markNotificationAsRead(key){

  if(!key) return;

  const readKey =
    `notifications_read_${member.id}`;

  let read = {};

  try{

    read = JSON.parse(
      localStorage.getItem(readKey) || '{}'
    );

  }catch(error){

    read = {};

  }

  read[key] = true;

  localStorage.setItem(
    readKey,
    JSON.stringify(read)
  );


  await updateNotificationBadge();

}

window.markNotificationAsRead =
  markNotificationAsRead;

async function openUserNotification(
  type,
  id,
  key
){

  // Marque UNIQUEMENT cette notification comme lue
  await markNotificationAsRead(key);


  // ==========================================================
  // 🎉 FESTIVITÉ
  // ==========================================================

  if(type === 'event'){

    closeModal();

    await showEvents();

    return;

  }


  // ==========================================================
  // 📊 SONDAGE
  // ==========================================================

  if(type === 'poll'){

    closeModal();

    await showPolls();

    return;

  }


  // ==========================================================
  // 📝 MESSAGE ADMIN
  // ==========================================================

  if(type === 'note'){

    closeModal();

    return;

  }


  // ==========================================================
  // 🧰 DEMANDE DE PRÊT
  // ==========================================================

  if(type === 'material'){

    closeModal();

    await showMyMaterialRequests();

    return;

  }

}

window.openUserNotification =
  openUserNotification;
// ============================================================
// 🔔 AFFICHAGE DES NOTIFICATIONS
// ============================================================

async function showNotifications(){

  const notifications =
    await getNewUserNotifications();


  openModal(`

    <h2>🔔 Notifications</h2>


    ${
      notifications.length

      ? `

        <div>

          ${notifications.map(n => `

            <div
              class="card"
              style="
                margin-bottom:12px;
                cursor:pointer;
              "
            >

              <h3 style="margin-top:0;">

                ${n.icon}

                ${esc(n.title)}

              </h3>


              <p>

                ${esc(n.message)}

              </p>


              ${
                n.type === 'note' && n.content

                ? `

                  <div
                    style="
                      margin-top:10px;
                      padding:10px;
                      border-radius:8px;
                      background:#f5f5f5;
                      white-space:pre-wrap;
                    "
                  >

                    ${esc(n.content)}

                  </div>

                `

                : ''

              }


            

            </div>

          `).join('')}

        </div>

      `

      : `

        <div class="card">

          <p>
            ✅ Aucune nouvelle notification.
          </p>

        </div>

      `
    }


    <div
      style="
        margin-top:15px;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="closeModal()"
      >

        Fermer

      </button>

    </div>

  `);

}

window.showNotifications =
  showNotifications;




async function getNewUserNotifications(){

  const data =
    await getUserNotifications();

  const readKey =
    `notifications_read_${member.id}`;

  let read = {};

  try{

    read = JSON.parse(
      localStorage.getItem(readKey) || '{}'
    );

  }catch(error){

    read = {};

  }


  const notifications = [];


  // ==========================================================
  // 🎉 FESTIVITÉS
  // ==========================================================

  (data.events || []).forEach(event => {

    const key =
      `event_${event.id}`;

    if(read[key]) return;


    notifications.push({

      type:'event',

      id:event.id,

      key:key,

      icon:'🎉',

      title:
        event.title ||
        'Nouvelle festivité',

      message:
        'Une nouvelle festivité est disponible. Consultez la rubrique Festivités.',

      date:
        event.created_at

    });

  });


  // ==========================================================
  // 📊 SONDAGES
  // ==========================================================

  (data.polls || []).forEach(poll => {

    const key =
      `poll_${poll.id}`;

    if(read[key]) return;


    notifications.push({

      type:'poll',

      id:poll.id,

      key:key,

      icon:'📊',

      title:
        poll.title ||
        'Nouveau sondage',

      message:
        'Un nouveau sondage est disponible. Consultez la rubrique Sondages.',

      date:
        poll.created_at

    });

  });

  // ==========================================================
  // 📢 PUBLICATIONS
  // ==========================================================

  (data.publications || []).forEach(publication => {

    const key =
      `publication_${publication.id}`;


    if(read[key]) return;


    let icon =
      '📢';


    if(
      publication.type ===
      'affiche'
    ){

      icon =
        '🖼️';

    }else if(
      publication.type ===
      'document'
    ){

      icon =
        '📄';

    }


    notifications.push({

      type:'publication',

      id:publication.id,

      key:key,

      icon:icon,

      title:
        publication.title ||
        'Nouvelle publication',

      message:
        publication.content ||
        'Une nouvelle publication est disponible. Consultez la rubrique Publications.',

      content:
        publication.content ||
        '',

      file_url:
        publication.file_url ||
        null,

      file_name:
        publication.file_name ||
        null,

      publication_type:
        publication.type ||
        'message',

      date:
        publication.created_at

    });

  });

  
  // ==========================================================
  // 📝 MESSAGE ADMINISTRATEUR
  // ==========================================================

  (data.notes || []).forEach(note => {

    const key =
      `note_${note.id}`;

    if(read[key]) return;


    notifications.push({

      type:'note',

      id:note.id,

      key:key,

      icon:'📝',

      title:
        note.title ||
        "Nouveau message",

      message:
        "Vous avez reçu un nouveau message de l'administrateur. Consultez vos messages.",

      content:
        note.content || '',

      date:
        note.created_at

    });

  });


  // ==========================================================
  // 📋 NOUVEAUX COMPTES RENDUS
  // ==========================================================

  try{

    const {data:reports,error} =
      await db

        .from('meeting_reports')

        .select(
          'id,title,meeting_type,meeting_date,created_at'
        )

        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(error){

      console.error(
        'ERREUR NOTIFICATIONS COMPTES RENDUS :',
        error
      );

    }else{

      (reports || []).forEach(report => {

        const key =
          `meeting_report_${report.id}`;


        if(read[key]) return;


        notifications.push({

          type:'meeting_report',

          id:report.id,

          key:key,

          icon:'📋',

          title:
            report.title ||
            'Nouveau compte rendu',

          message:
            'Un nouveau compte rendu de réunion est disponible. Consultez la rubrique Comptes rendus.',

          date:
            report.created_at ||
            report.meeting_date

        });

      });

    }

  }catch(error){

    console.error(
      'ERREUR NOTIFICATIONS COMPTES RENDUS :',
      error
    );

  }


  // ==========================================================
  // 🧰 RÉPONSES AUX DEMANDES DE PRÊT
  // ==========================================================

  try{

    const {data:requests,error} =
      await db

        .from('material_requests')

        .select(
          'id,status,created_at'
        )

        .eq(
          'member_id',
          member.id
        )

        .in(
          'status',
          ['approved','refused']
        );


    if(error){

      console.error(
        'ERREUR NOTIFICATIONS PRÊTS :',
        error
      );

    }else{

      (requests || []).forEach(request => {

        const key =
          `material_${request.id}_${request.status}`;


        if(read[key]) return;


        // 🟢 ACCEPTÉE

        if(
          request.status ===
          'approved'
        ){

          notifications.push({

            type:'material',

            id:request.id,

            key:key,

            icon:'🟢',

            title:
              'Demande de prêt acceptée',

            message:
              'Votre demande de prêt de matériel a été acceptée. Consultez vos demandes.',

            date:
              request.created_at

          });

        }


        // 🔴 REFUSÉE

        if(
          request.status ===
          'refused'
        ){

          notifications.push({

            type:'material',

            id:request.id,

            key:key,

            icon:'🔴',

            title:
              'Demande de prêt refusée',

            message:
              'Votre demande de prêt de matériel a été refusée. Consultez vos demandes.',

            date:
              request.created_at

          });

        }

      });

    }

  }catch(error){

    console.error(
      'ERREUR NOTIFICATIONS PRÊTS :',
      error
    );

  }


  // ==========================================================
  // 🔄 TRI DES NOTIFICATIONS
  // Les plus récentes en premier
  // ==========================================================

  notifications.sort((a,b) => {

    const dateA =
      a.date
        ? new Date(a.date).getTime()
        : 0;

    const dateB =
      b.date
        ? new Date(b.date).getTime()
        : 0;

    return dateB - dateA;

  });


  return notifications;

}

// ============================================================
// 🗑️ SUPPRIMER UN MESSAGE ADMINISTRATEUR
// ============================================================

async function dismissAdminNote(noteId){

  if(!member?.id){

    alert('Vous devez être connecté.');

    return;

  }

  if(!noteId){

    return;

  }

  try{

    const {error} = await db
      .from('admin_note_dismissals')
      .insert({

        note_id:noteId,

        member_id:member.id

      });

    if(error){

      /*
        Si l'utilisateur a déjà supprimé
        le message, on ne bloque pas.
      */

      if(
        !String(error.message || '')
          .toLowerCase()
          .includes('duplicate')
      ){

        throw error;

      }

    }

    /*
      Recharge immédiatement les notifications.
    */

    await updateNotificationBadge();

    /*
      Réaffiche la fenêtre des notifications
      avec le message supprimé retiré.
    */

    await showNotifications();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION NOTIFICATION :',
      error
    );

    alert(
      error.message ||
      'Impossible de supprimer cette notification.'
    );

  }

}

window.dismissAdminNote =
  dismissAdminNote;


// ============================================================
// 🔔 AFFICHAGE DES NOTIFICATIONS
// ============================================================




function startNotificationCheck(){

  // Vérification immédiate
  updateNotificationBadge();
  updateConversationUnreadBadge();

  // Évite plusieurs timers
  if(notificationTimer){
    clearInterval(notificationTimer);
  }

  notificationTimer = setInterval(() => {

    if(!$('homeUser')?.classList.contains('hidden')){

      updateNotificationBadge();
      updateConversationUnreadBadge();

    }

  },10000);

}


async function answerEvent(id) {
  try {
    if (!member?.id) {
      alert('Vous devez être connecté.');
      return;
    }

    const { data: response, error: responseError } = await db
      .from('event_responses')
      .select('id')
      .eq('event_id', id)
      .eq('member_id', member.id)
      .maybeSingle();

    if (responseError) throw responseError;

    // =====================================================
    // SI LE MEMBRE A DÉJÀ RÉPONDU
    // =====================================================

    if (response) {
      openModal(`
        <div style="text-align:center;padding:10px 0;">

          <div style="font-size:45px;margin-bottom:12px;">
            ℹ️
          </div>

          <h2>Vous avez déjà répondu !</h2>

          <p style="margin:18px 0;line-height:1.6;">
            Vous avez déjà répondu à cette festivité.
            Consultez votre réponse en cliquant sur
            <strong>« Vos réponses »</strong>.
          </p>

          <div class="row" style="justify-content:center;gap:8px;">

            <button
              type="button"
              class="primary"
              onclick="closeModal();showMyEventResponses();"
            >
              📋 Vos réponses
            </button>

            <button
              type="button"
              class="ghost"
              onclick="closeModal()"
            >
              Fermer
            </button>

          </div>

        </div>
      `);

      return;
    }

    // =====================================================
    // LE MEMBRE N'A PAS ENCORE RÉPONDU
    // ON AFFICHE LE FORMULAIRE NORMAL
    // =====================================================

    const { data: event, error: eventError } = await db
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) throw eventError;

    openModal(`
      <h2>Réponse — ${esc(event.title)}</h2>

      <div class="field">
        <label>Votre présence</label>
        <select id="attend" class="select">
          <option value="true" selected>
            Je serai présent(e)
          </option>
          <option value="false">
            Je ne serai pas présent(e)
          </option>
        </select>
      </div>

      ${
        event.spouses_invited
          ? `
            <label class="check">
              <input id="spouse" type="checkbox">
              Mon conjoint sera présent
            </label>
          `
          : ''
      }

      ${
        event.children_invited
          ? `
            <div class="field">
              <label>Nombre d'enfants</label>
              <input
                id="children"
                class="input"
                type="number"
                min="0"
                value="0"
              >
            </div>
          `
          : ''
      }

      ${
        event.gift_enabled
          ? `
            <label class="check">
              <input id="gift" type="checkbox">
              Je souhaite le bon cadeau
            </label>
          `
          : ''
      }

      <div class="field">
        <label>Commentaire</label>
        <textarea
          id="comment"
          class="textarea"
        ></textarea>
      </div>

      <div class="row" style="margin-top:15px;gap:8px;">

        <button
          type="button"
          class="primary"
          onclick="saveEventResponse('${id}',null)"
        >
          Enregistrer ma réponse
        </button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Annuler
        </button>

      </div>
    `);

  } catch (error) {
    console.error('ERREUR RÉPONSE FESTIVITÉ :', error);

    alert(
      error.message ||
      'Impossible de charger la festivité.'
    );
  }
}

async function showMyEventResponses(){
  try{
    if(!member?.id){
      alert('Vous devez être connecté.');
      return;
    }

    const {data:responses,error}=await db
      .from('event_responses')
      .select(`
        id,
        event_id,
        attending,
        spouse_attending,
        children_count,
        gift_requested,
        comment,
        responded_at,
        events(
          title,
          event_date,
          event_time,
          location
        )
      `)
      .eq('member_id',member.id)
      .order('responded_at',{ascending:false});

    if(error)throw error;

    const list=responses||[];

    let html=`
      <h2>📋 Mes réponses aux festivités</h2>

      <div class="grid" style="margin-top:15px;">
    `;

    if(list.length===0){

      html+=`
        <div class="card">
          <h3>📭 Aucune réponse</h3>
          <p>Vous n'avez encore répondu à aucune festivité.</p>
        </div>
      `;

    }else{

      for(const r of list){

        const event=r.events||{};

        const presence=r.attending===true
          ? '✅ Présent(e)'
          : '❌ Absent(e)';

        html+=`
          <div class="card">

            <h3>
              🎉 ${esc(event.title||'Festivité inconnue')}
            </h3>

            <p>
              📅 <strong>Date :</strong>
              ${fmtDate(event.event_date||'')}
              ${
                event.event_time
                ? ` · ${event.event_time.slice(0,5)}`
                : ''
              }
            </p>

            ${
              event.location
              ? `
                <p>
                  📍 <strong>Lieu :</strong>
                  ${esc(event.location)}
                </p>
              `
              : ''
            }

            <hr>

            <p>
              <strong>Votre présence :</strong>
              ${presence}
            </p>

            ${
              r.attending===true && r.spouse_attending===true
              ? `
                <p>
                  💑 <strong>Conjoint :</strong>
                  Présent(e)
                </p>
              `
              : r.attending===true
              ? `
                <p>
                  💑 <strong>Conjoint :</strong>
                  Non
                </p>
              `
              : ''
            }

            ${
              r.attending===true && Number(r.children_count||0)>0
              ? `
                <p>
                  👶 <strong>Enfants :</strong>
                  ${Number(r.children_count)}
                </p>
              `
              : ''
            }

            ${
              r.gift_requested
              ? `
                <p>
                  🎁 <strong>Bon cadeau :</strong>
                  Oui
                </p>
              `
              : ''
            }

            ${
              r.comment
              ? `
                <p>
                  💬 <strong>Commentaire :</strong>
                  ${esc(r.comment)}
                </p>
              `
              : ''
            }

            <div class="row" style="margin-top:12px">

              <button
                type="button"
                class="ghost"
                onclick="deleteEventResponse('${r.id}')">
                🗑️ Supprimer ma réponse
              </button>

            </div>

          </div>
        `;
      }
    }

    html+=`
      </div>

      <div
        class="row"
        style="justify-content:center;margin-top:20px">

        <button
          type="button"
          class="primary"
          onclick="closeModal()">
          Fermer
        </button>

      </div>
    `;

    openModal(html);

  }catch(error){

    console.error(
      'ERREUR MES RÉPONSES FESTIVITÉS :',
      error
    );

    alert(
      error.message||
      'Impossible de charger vos réponses.'
    );
  }
}

async function markAllNotificationsAsRead(){

  if(!member || !member.id) return;


  const notifications =
    await getNewUserNotifications();


  if(!notifications.length){

    await updateNotificationBadge();

    return;

  }


  const readKey =
    `notifications_read_${member.id}`;


  let read = {};


  try{

    read = JSON.parse(
      localStorage.getItem(readKey) || '{}'
    );

  }catch(error){

    read = {};

  }


  notifications.forEach(n => {

    if(n.key){

      read[n.key] = true;

    }

  });


  localStorage.setItem(
    readKey,
    JSON.stringify(read)
  );


  // Faire disparaître immédiatement le bandeau
  const badge =
    $('notificationBadge');

  if(badge){

    badge.style.display =
      'none';

  }

}

window.markAllNotificationsAsRead =
  markAllNotificationsAsRead;

// ============================================================
// 📝 PUBLICATION D'UN MESSAGE AUX MEMBRES
// ============================================================

async function createAdminNote(){

  try{

    // =====================================================
    // 1. Vérification administrateur
    // =====================================================

    if(
      !member ||
      String(member.role).toLowerCase() !== 'admin'
    ){

      alert('Accès administrateur requis.');

      return;
    }


    // =====================================================
    // 2. Récupérer le titre et le contenu
    // =====================================================

    const title =
      $('adminNoteTitle')?.value.trim() || '';

    const content =
      $('adminNoteContent')?.value.trim() || '';


    if(!title){

      alert(
        'Veuillez saisir un titre.'
      );

      return;
    }


    if(!content){

      alert(
        'Veuillez saisir un message.'
      );

      return;
    }


    // =====================================================
    // 3. Récupérer le destinataire
    // =====================================================

    const recipient =
      $('adminNoteRecipient')?.value || 'all';

    const selectedMemberId =
  $('adminNoteMember')?.value || '';

    // =====================================================
    // 4. Préparer la cible Push
    // =====================================================

    let pushBody = {

      title:
        title,

      message:
        content

    };


    // -----------------------------------------------------
    // 👥 TOUS LES MEMBRES
    // -----------------------------------------------------

    if(recipient === 'all'){

      pushBody.all_members =
        true;

    }


    // -----------------------------------------------------
    // 🏛️ BUREAU DE L'AMICALE
    // -----------------------------------------------------

    else if(recipient === 'bureau'){

      pushBody.bureau_amicale =
        true;

    }


    // -----------------------------------------------------
    // 👤 MEMBRE PRÉCIS
    // -----------------------------------------------------

    else if(recipient === 'member'){

    


      if(!selectedMemberId){

        alert(
          'Veuillez sélectionner un membre.'
        );

        return;
      }


      pushBody.member_id =
        selectedMemberId;

    }


    // =====================================================
    // 5. Publier le message
    // =====================================================

    console.log(
      'PUBLICATION MESSAGE :',
      {
        title,
        content,
        recipient,
        pushBody
      }
    );


    const {
  data,
  error
} = await db
  .from('admin_notes')
  .insert({

    title:
      title,

    content:
      content,

    active:
      true,

    recipient_type:
      recipient,

    recipient_member_id:
      recipient === 'member'
        ? selectedMemberId
        : null

  })
  .select()
  .single();


    if(error){

      console.error(
        'ERREUR PUBLICATION MESSAGE :',
        error
      );

      throw error;

    }


    console.log(
      'MESSAGE PUBLIÉ :',
      data
    );


    // =====================================================
    // 6. Envoyer la notification Push
    // =====================================================

    try{

      const {
        data: pushData,
        error: pushError
      } = await db.functions.invoke(
        'send-push',
        {
          body:
            pushBody
        }
      );


      if(pushError){

        console.error(
          '❌ ERREUR PUSH MESSAGE :',
          pushError
        );

      }else{

        console.log(
          '✅ PUSH MESSAGE ENVOYÉ :',
          pushData
        );

      }

    }catch(pushError){

      /*
        IMPORTANT :
        Si la notification Push échoue,
        le message reste quand même publié
        dans l'application.
      */

      console.error(
        '❌ ERREUR NOTIFICATION MESSAGE :',
        pushError
      );

    }


    // =====================================================
    // 7. Vider les champs
    // =====================================================

    if($('adminNoteTitle')){

      $('adminNoteTitle').value = '';

    }


    if($('adminNoteContent')){

      $('adminNoteContent').value = '';

    }


    if($('adminNoteRecipient')){

      $('adminNoteRecipient').value =
        'all';

    }


    if($('adminNoteMember')){

      $('adminNoteMember').value =
        '';

      $('adminNoteMember').style.display =
        'none';

    }


    // =====================================================
    // 8. Confirmation
    // =====================================================

    alert(
      '✅ Message publié avec succès.'
    );


    // =====================================================
    // 9. Actualiser l'administration
    // =====================================================

    await renderAdmin();


  }catch(error){

    console.error(
      'ERREUR CREATE ADMIN NOTE :',
      error
    );


    alert(
      error?.message ||
      'Impossible de publier le message.'
    );

  }

}


window.createAdminNote =
  createAdminNote;


async function deleteEventResponse(responseId){
  if(!confirm('Voulez-vous vraiment supprimer votre réponse à cette festivité ?')){
    return;
  }

  try{
    const {error}=await db
      .from('event_responses')
      .delete()
      .eq('id',responseId)
      .eq('member_id',member.id);

    if(error)throw error;

    alert('✅ Votre réponse a été supprimée.');

    await showMyEventResponses();

  }catch(error){
    console.error('ERREUR SUPPRESSION RÉPONSE FESTIVITÉ :',error);
    alert(error.message||'Impossible de supprimer votre réponse.');
  }
}

function previewEventPoster(){

  const file =
    document.getElementById('eventPoster')
      ?.files?.[0];

  const preview =
    document.getElementById('eventPosterPreview');

  const previewImg =
    document.getElementById('eventPosterPreviewImg');

  if(!file){

    preview.style.display = 'none';
    previewImg.src = '';

    return;
  }

  const reader =
    new FileReader();

  reader.onload = function(event){

    previewImg.src =
      event.target.result;

    preview.style.display =
      'block';

  };

  reader.readAsDataURL(file);
}

async function saveEventResponse(eventId, responseId) {
  try {
    if (!member?.id) {
      alert('Vous devez être connecté.');
      return;
    }

    // Vérifier à nouveau si le membre a déjà répondu
    const { data: existing, error: checkError } = await db
      .from('event_responses')
      .select('id')
      .eq('event_id', eventId)
      .eq('member_id', member.id)
      .maybeSingle();

    if (checkError) throw checkError;

    // Si une réponse existe déjà et qu'il ne s'agit pas
    // d'une modification explicite, empêcher le doublon
    if (existing && !responseId) {
      closeModal();

      openModal(`
        <div style="text-align:center;padding:10px;">
          <div style="font-size:42px;margin-bottom:12px;">ℹ️</div>
          <h2>Vous avez déjà répondu !</h2>
          <p>Votre réponse à cette festivité est déjà enregistrée.</p>
          <div class="row" style="justify-content:center;gap:8px;">
            <button type="button" class="primary"
              onclick="closeModal();showMyEventResponses();">
              📋 Vos réponses
            </button>
            <button type="button" class="ghost"
              onclick="closeModal()">
              Fermer
            </button>
          </div>
        </div>
      `);

      return;
    }

    const payload = {
      event_id: eventId,
      member_id: member.id,
      attending: $('attend')?.value === 'true',
      spouse_attending: $('spouse')?.checked || false,
      children_count: Number($('children')?.value || 0),
      gift_requested: $('gift')?.checked || false,
      comment: $('comment')?.value || '',
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = responseId
      ? await db.from('event_responses')
          .update(payload)
          .eq('id', responseId)
          .eq('member_id', member.id)
      : await db.from('event_responses').insert(payload);

    if (result.error) throw result.error;

    closeModal();
    alert('Réponse enregistrée.');
    await showEvents();

  } catch (error) {
    console.error('ERREUR ENREGISTREMENT RÉPONSE :', error);
    alert(error.message || 'Impossible d’enregistrer la réponse.');
  }
}

async function showPolls(){
  try{
    if(!member?.id){
      alert('Vous devez être connecté.');
      return;
    }

    const {data:polls,error}=await db
      .from('polls')
      .select('id,title,description,multiple_choices,active')
      .eq('active',true)
      .order('created_at',{ascending:false});

    if(error)throw error;

    const list=polls||[];

    let html='';

    html+='<h2>📊 Sondages</h2>';

    if(!list.length){
      html+='<div class="card">';
      html+='<p>📭 Aucun sondage disponible actuellement.</p>';
      html+='</div>';
    }

    for(const poll of list){

      const {data:options,error:optionsError}=await db
        .from('poll_options')
        .select('id,option_text,display_order')
        .eq('poll_id',poll.id)
        .order('display_order',{ascending:true});

      if(optionsError)throw optionsError;

      const {data:responses,error:responsesError}=await db
        .from('poll_responses')
        .select('option_id')
        .eq('poll_id',poll.id)
        .eq('member_id',member.id);

      if(responsesError)throw responsesError;

      const myResponses=responses||[];

      html+='<div class="card" style="margin-top:15px;">';

      html+='<h3>📊 '+esc(poll.title||'Sondage')+'</h3>';

      if(poll.description){
        html+='<p>'+esc(poll.description)+'</p>';
      }

      html+='<div style="margin-top:15px;">';

      for(const option of (options||[])){

        const alreadyAnswered=myResponses.some(
          r=>String(r.option_id)===String(option.id)
        );

        const inputType=poll.multiple_choices
          ? 'checkbox'
          : 'radio';

        html+='<label style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:10px;cursor:pointer;">';

        html+='<input ';
        html+='type="'+inputType+'" ';
        html+='name="poll_'+poll.id+'" ';
        html+='value="'+option.id+'" ';

        if(alreadyAnswered){
          html+='checked ';
        }

        html+='>';

        html+='<span>'+esc(option.option_text||'')+'</span>';

        html+='</label>';
      }

      html+='</div>';

      html+='<button type="button" class="primary" style="margin-top:10px;" ';
      html+='onclick="savePollResponse(\''+poll.id+'\','+poll.multiple_choices+')">';
      html+='✅ Enregistrer ma réponse';
      html+='</button>';

      html+='</div>';
    }


    /* =====================================================
       BOUTONS DE LA POPUP SONDAGES
       ===================================================== */

    html+=`
      <div
        style="
          display:flex;
          gap:10px;
          justify-content:center;
          flex-wrap:wrap;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="showMyPollResponses()"
        >
          📋 Mes réponses
        </button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>
    `;


    openModal(html);

  }catch(error){
    console.error('ERREUR SONDAGES :',error);
    alert(error.message||'Impossible de charger les sondages.');
  }
}


async function savePollResponse(pollId, multipleChoices){

  try{

    // =========================================================
    // VÉRIFICATION DU MEMBRE
    // =========================================================

    if(!member || !member.id){

      alert('Impossible de retrouver votre compte.');

      return;

    }


    // =========================================================
    // RÉCUPÉRATION DES OPTIONS SÉLECTIONNÉES
    // =========================================================

    const selector =
      multipleChoices
        ? 'input[name="poll_' + pollId + '"]:checked'
        : 'input[name="poll_' + pollId + '"]:checked';


    const selected =
      Array.from(
        document.querySelectorAll(selector)
      );


    if(!selected.length){

      alert('Veuillez sélectionner une réponse.');

      return;

    }


    // =========================================================
    // VÉRIFICATION DU SONDAGE
    // =========================================================

    const {
      data:poll,
      error:pollError
    } = await db
      .from('polls')
      .select('id,allow_change_vote,active,end_date')
      .eq('id',pollId)
      .maybeSingle();


    if(pollError) throw pollError;


    if(!poll){

      alert('Sondage introuvable.');

      return;

    }


    // =========================================================
    // VÉRIFICATION DE L'ANCIENNE RÉPONSE
    // =========================================================

    const {
      data:existingResponses,
      error:existingError
    } = await db
      .from('poll_responses')
      .select('id,option_id')
      .eq('poll_id',pollId)
      .eq('member_id',member.id);


    if(existingError) throw existingError;


    const existing =
      existingResponses || [];


    // =========================================================
    // SI UNE RÉPONSE EXISTE DÉJÀ
    // =========================================================

    if(existing.length){

      if(poll.allow_change_vote === false){

        alert(
          'Vous avez déjà répondu à ce sondage.'
        );

        return;

      }


      /*
       * IMPORTANT :
       * On ne supprime rien ici pour ne pas dépendre
       * d'une modification de tes policies RLS.
       *
       * Si le changement de vote doit être réactivé,
       * on pourra traiter séparément la policy DELETE.
       */

      alert(
        'Vous avez déjà répondu à ce sondage.'
      );

      return;

    }


    // =========================================================
    // RÉCUPÉRATION DE L'ID RÉEL DU MEMBRE
    // =========================================================

    const {
      data:currentMemberId,
      error:memberIdError
    } = await db.rpc(
      'current_member_id'
    );


    if(memberIdError){

      throw memberIdError;

    }


    if(!currentMemberId){

      alert(
        'Impossible de retrouver votre membre associé.'
      );

      return;

    }


    // =========================================================
    // PRÉPARATION DES RÉPONSES
    // =========================================================

    const rows =
      selected.map(input => ({

        poll_id: pollId,

        option_id: input.value,

        member_id: currentMemberId

      }));


    // =========================================================
    // ENREGISTREMENT
    // =========================================================

    const {
      error:insertError
    } = await db
      .from('poll_responses')
      .insert(rows);


    if(insertError){

      console.error(
        'ERREUR ENREGISTREMENT RÉPONSE :',
        insertError
      );

      throw insertError;

    }


    // =========================================================
    // CONFIRMATION
    // =========================================================

    alert(
      '✅ Votre réponse a bien été enregistrée.'
    );


    // Fermer le popup si présent
    if(typeof closeModal === 'function'){

      closeModal();

    }


    // Rafraîchir l'affichage si la fonction existe
    if(typeof showPolls === 'function'){

      try{

        await showPolls();

      }catch(refreshError){

        console.warn(
          'Rafraîchissement des sondages impossible :',
          refreshError
        );

      }

    }

  }catch(error){

    console.error(
      'ERREUR SAVE POLL RESPONSE :',
      error
    );

    alert(
      error?.message ||
      'Impossible d’enregistrer votre réponse.'
    );

  }

}

async function showMyPollResponses(){
  try{

    const {data:currentMemberId,error:memberError} =
      await db.rpc('current_member_id');

    if(memberError) throw memberError;

    if(!currentMemberId){
      alert('Vous devez être connecté.');
      return;
    }

    const {data:responses,error}=await db
      .from('poll_responses')
      .select(`
        id,
        poll_id,
        option_id,
        created_at,
        polls(title),
        poll_options(option_text)
      `)
      .eq('member_id',currentMemberId)
      .order('created_at',{ascending:false});

    if(error) throw error;

    const list=responses||[];

    let html='<h2>📊 Mes réponses</h2>';

    if(!list.length){

      html+=`
        <div class="card" style="margin-top:15px;">
          <p>📭 Vous n'avez encore répondu à aucun sondage.</p>
        </div>
      `;

    }else{

      for(const response of list){

        html+=`
          <div class="card" style="margin-top:15px;">
            <h3>📊 ${esc(response.polls?.title||'Sondage')}</h3>

            <p>
              <strong>Ma réponse :</strong>
              ${esc(response.poll_options?.option_text||'')}
            </p>

            <button
              type="button"
              class="ghost"
              style="margin-top:10px;"
              onclick="deleteMyPollResponse('${response.id}')">
              🗑️ Supprimer ma réponse
            </button>
          </div>
        `;
      }
    }

    html+=`
      <div class="row" style="justify-content:center;margin-top:20px;">
        <button
          type="button"
          class="ghost"
          onclick="closeModal()">
          Fermer
        </button>
      </div>
    `;

    openModal(html);

  }catch(error){

    console.error('ERREUR MES RÉPONSES :',error);
    alert(error.message||'Impossible de charger vos réponses.');

  }
}



async function deleteMyPollResponse(responseId){

  if(!confirm('Voulez-vous vraiment supprimer cette réponse ?')){
    return;
  }

  try{

    const {data:currentMemberId,error:memberError} =
      await db.rpc('current_member_id');

    if(memberError) throw memberError;

    if(!currentMemberId){
      alert('Impossible de retrouver votre compte.');
      return;
    }

    const {data,error}=await db
      .from('poll_responses')
      .delete()
      .eq('id',responseId)
      .eq('member_id',currentMemberId)
      .select('id');

    if(error) throw error;

    if(!data || data.length===0){
      alert('La suppression a été refusée. Vérifiez les autorisations Supabase.');
      return;
    }

    alert('✅ Votre réponse a bien été supprimée.');

    await showMyPollResponses();

  }catch(error){

    console.error('ERREUR SUPPRESSION RÉPONSE :',error);

    alert(error.message||'Impossible de supprimer votre réponse.');

  }
}


async function showMaterials(){
  try{
    const {data,error}=await db
      .from('materials')
      .select('id,name,description,quantity,available,loan_allowed')
      .eq('available',true)
      .eq('loan_allowed',true)
      .order('name',{ascending:true});

    if(error)throw error;

    const materials=data||[];

    let html=`
      <h2>🧰 Matériel disponible</h2>

      <div class="grid" style="margin-top:15px;">
    `;

    if(!materials.length){

      html+=`
        <div class="card">
          <h3>🧰 Aucun matériel disponible</h3>
          <p>Aucun matériel n'est actuellement disponible au prêt.</p>
        </div>
      `;

    }else{

      materials.forEach(m=>{

        html+=`
          <div class="card">
            <h3>🧰 ${esc(m.name||'Matériel')}</h3>

            ${
              m.description
              ? `<p>${esc(m.description)}</p>`
              : ''
            }

            <p>
              <strong>Quantité disponible :</strong>
              ${Number(m.quantity||0)}
            </p>

            <div class="row" style="margin-top:12px;">
              <button
                type="button"
                class="primary"
                onclick="requestMaterial('${m.id}')">
                📋 Demander le prêt
              </button>
            </div>
          </div>
        `;

      });
    }

    html+=`
      </div>

      <hr style="margin:20px 0;">

      <div class="row" style="justify-content:center;gap:8px;">

        <button
          type="button"
          class="ghost"
          onclick="closeModal();showMyMaterialRequests();">
          📋 Voir mes demandes
        </button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()">
          Fermer
        </button>

      </div>
    `;

    openModal(html);

  }catch(error){
    console.error('ERREUR MATÉRIEL :',error);
    alert(error.message||'Impossible de charger le matériel.');
  }
}

async function requestMaterial(materialId){
  if(!member?.id){alert('Vous devez être connecté pour demander un prêt.');return;}
  try{
    const {data:material,error}=await db.from('materials').select('id,name,quantity,available,loan_allowed').eq('id',materialId).single();
    if(error)throw error;
    if(!material.available||!material.loan_allowed){alert('Ce matériel n’est plus disponible au prêt.');return;}
    openModal(`<h2>🧰 Demande de prêt</h2><p><strong>Matériel :</strong> ${esc(material.name)}</p><p>Quantité disponible : ${Number(material.quantity||0)}</p><div class="field"><label>Début du prêt</label><input id="start" class="input" type="datetime-local"></div><div class="field"><label>Retour</label><input id="end" class="input" type="datetime-local"></div><div class="field"><label>Motif</label><input id="reason" class="input" placeholder="Motif du prêt"></div><div class="field"><label>Commentaire</label><textarea id="comment" class="textarea" placeholder="Commentaire éventuel"></textarea></div><div class="row"><button class="primary" onclick="saveMaterialRequest('${material.id}')">📤 Envoyer la demande</button><button class="ghost" onclick="closeModal()">Annuler</button></div>`);
  }catch(error){console.error('ERREUR DEMANDE MATÉRIEL :',error);alert(error.message||'Impossible de charger le matériel.');}
}

async function saveMaterialRequest(materialId){
  try{
    const startValue=$('start')?.value||'',
          endValue=$('end')?.value||'',
          reason=$('reason')?.value.trim()||'',
          comment=$('comment')?.value.trim()||'';

    if(!startValue||!endValue){
      alert('Veuillez renseigner les dates de début et de retour.');
      return;
    }

    const startDate=new Date(startValue),
          endDate=new Date(endValue);

    if(
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ){
      alert('Les dates sont invalides.');
      return;
    }

    if(endDate<=startDate){
      alert(
        'La date de retour doit être après la date de début.'
      );
      return;
    }

    const requestId=crypto.randomUUID();

    const {error}=await db
      .from('material_requests')
      .insert({
        id:requestId,
        member_id:member.id,
        start_date:startDate.toISOString(),
        return_date:endDate.toISOString(),
        reason,
        comment,
        status:'pending'
      });

    if(error)throw error;


    const {error:itemError}=await db
      .from('material_request_items')
      .insert({
        request_id:requestId,
        material_id:materialId,
        quantity:1
      });

    if(itemError)throw itemError;


    /* =========================================================
       📧 NOTIFICATION EMAIL ADMIN
       ========================================================= */

    sendAdminEmailNotification(
      'material_request',
      '🧰 Nouvelle demande de matériel',

      `Motif : ${reason || '—'}

Commentaire : ${comment || '—'}

Du : ${startDate.toLocaleString('fr-FR')}
Au : ${endDate.toLocaleString('fr-FR')}`,

      `${member.first_name || ''} ${member.last_name || ''}`.trim()
    );


    closeModal();

    alert(
      '✅ Demande envoyée à l’administrateur.'
    );

  }catch(error){

    console.error(
      'ERREUR ENREGISTREMENT DEMANDE :',
      error
    );

    alert(
      error.message ||
      'Impossible d’envoyer la demande.'
    );

  }
}

async function deleteMaterialRequest(id){
  try{
    if(!confirm('Supprimer cette demande de matériel ?'))return;

    const {error:itemError}=await db
      .from('material_request_items')
      .delete()
      .eq('request_id',id);

    if(itemError)throw itemError;

    const {error}=await db
      .from('material_requests')
      .delete()
      .eq('id',id);

    if(error)throw error;

    alert('✅ Demande supprimée.');
    await showMyMaterialRequests();

  }catch(error){
    console.error('ERREUR SUPPRESSION DEMANDE :',error);
    alert(error.message||'Impossible de supprimer la demande.');
  }
}



async function showMyMaterialRequests(){
  try{
    if(!member?.id){
      alert('Vous devez être connecté.');
      return;
    }

    const {data:reqs,error}=await db
      .from('material_requests')
      .select(`
        id,
        start_date,
        return_date,
        status,
        reason,
        comment,
        created_at
      `)
      .eq('member_id',member.id)
      .order('created_at',{ascending:false});

    if(error)throw error;

    const requests=reqs||[];

    let html=`
      

      <div class="grid" style="margin-top:15px;">
    `;

    if(requests.length===0){

      html+=`
        <div class="card">
          <p>📭 Vous n'avez aucune demande de matériel.</p>
        </div>
      `;

    }else{

      for(const r of requests){

        const {data:items,error:itemError}=await db
          .from('material_request_items')
          .select('quantity,material_id')
          .eq('request_id',r.id);

        if(itemError)throw itemError;

        let materialNames=[];

        for(const item of items||[]){

          const {data:m,error:materialError}=await db
            .from('materials')
            .select('name')
            .eq('id',item.material_id)
            .maybeSingle();

          if(materialError)throw materialError;

          materialNames.push(
            `${m?.name||'Matériel inconnu'} × ${Number(item.quantity||1)}`
          );
        }

        let statusText='';

        if(r.status==='approved'){
          statusText='✅ Acceptée';
        }else if(r.status==='refused'){
          statusText='❌ Refusée';
        }else{
          statusText='⏳ En attente';
        }

        html+=`
          <div class="card">

            <h3>
              🧰 ${esc(
                materialNames.join(', ')||'Matériel inconnu'
              )}
            </h3>

            <p>
              📅 <strong>Du :</strong>
              ${fmtDate(r.start_date)}
            </p>

            <p>
              📅 <strong>Au :</strong>
              ${fmtDate(r.return_date)}
            </p>

            <p>
              📝 <strong>Motif :</strong>
              ${esc(r.reason||'—')}
            </p>

            ${
              r.comment
              ? `
                <p>
                  💬 <strong>Commentaire :</strong>
                  ${esc(r.comment)}
                </p>
              `
              : ''
            }

            <p>
              <strong>Statut :</strong>
              ${statusText}
            </p>

            <div class="row" style="margin-top:12px">

              <button
                type="button"
                class="ghost"
                onclick="deleteMaterialRequest('${r.id}')">
                🗑️ Supprimer
              </button>

            </div>

          </div>
        `;
      }
    }

    html+=`
      </div>

      <div
        class="row"
        style="justify-content:center;margin-top:20px">

        <button
          type="button"
          class="primary"
          onclick="closeModal()">
          Fermer
        </button>

      </div>
    `;

    openModal(html);

  }catch(error){

    console.error(
      'ERREUR MES DEMANDES :',
      error
    );

    alert(
      error.message||
      'Impossible de charger vos demandes.'
    );
  }
}

async function showIdeaForm(){
  openModal(`<h2>💡 Proposer une idée</h2><div class="field"><label>Votre idée</label><textarea id="ideaContent" class="textarea" placeholder="Écrivez votre idée ici..."></textarea></div><div class="row"><button class="primary" onclick="saveIdea()">📤 Envoyer</button><button class="ghost" onclick="closeModal()">Annuler</button></div>`);
}

async function saveIdea(){
  try{
    const content=$('ideaContent')?.value.trim()||'';
    if(!content){alert('Veuillez saisir votre idée.');return;}
    const {error}=await db.from('ideas').insert({member_id:member.id,content,status:'new'});
    if(error)throw error;
    sendAdminEmailNotification(
  'idea',
  '💡 Nouvelle idée',
  content,
  `${member.first_name || ''} ${member.last_name || ''}`.trim()
);
    closeModal();alert('💡 Votre idée a bien été envoyée.');
  }catch(error){console.error('ERREUR IDÉE :',error);alert(error.message||'Impossible d’envoyer votre idée.');}
}

async function setRequestStatus(id,status){

  try{

    // =====================================================
    // 1. Vérifier le statut demandé
    // =====================================================

    if(
      status !== 'approved' &&
      status !== 'refused'
    ){

      throw new Error(
        'Statut de demande invalide.'
      );

    }


    // =====================================================
    // 2. Récupérer le membre qui a fait la demande
    // =====================================================

    const {
      data: request,
      error: requestError
    } = await db
      .from('material_requests')
      .select(
        'id, member_id'
      )
      .eq(
        'id',
        id
      )
      .maybeSingle();


    if(requestError)
      throw requestError;


    if(!request){

      throw new Error(
        'Demande de prêt introuvable.'
      );

    }


    if(!request.member_id){

      throw new Error(
        'Impossible de trouver le membre ayant effectué la demande.'
      );

    }


    // =====================================================
    // 3. Modifier le statut
    // =====================================================

    const {
      error
    } = await db
      .from('material_requests')
      .update({

        status:
          status,

        updated_at:
          new Date().toISOString()

      })
      .eq(
        'id',
        id
      );


    if(error)
      throw error;


    // =====================================================
    // 4. Préparer le texte de notification
    // =====================================================

    const pushTitle =
      status === 'approved'
        ? '🟢 Demande de prêt acceptée'
        : '🔴 Demande de prêt refusée';


    const pushMessage =
      status === 'approved'
        ? 'Votre demande de prêt de matériel a été acceptée.'
        : 'Votre demande de prêt de matériel a été refusée.';


    // =====================================================
    // 5. Envoyer la notification Push
    // =====================================================

    try{

      const {
        data: pushData,
        error: pushError
      } = await db.functions.invoke(
        'send-push',
        {

          body: {

            member_id:
              request.member_id,

            title:
              pushTitle,

            message:
              pushMessage

          }

        }
      );


      if(pushError){

        console.error(
          '❌ ERREUR PUSH DEMANDE DE PRÊT :',
          pushError
        );

      }else{

        console.log(
          '✅ PUSH DEMANDE DE PRÊT ENVOYÉ :',
          pushData
        );

      }

    }catch(pushError){

      // =================================================
      // IMPORTANT :
      // Une erreur Push ne doit pas annuler
      // l'acceptation/refus du prêt.
      // =================================================

      console.error(
        '❌ ERREUR NOTIFICATION PRÊT :',
        pushError
      );

    }


    // =====================================================
    // 6. Actualiser l'administration
    // =====================================================

    await renderAdmin();


  }catch(error){

    console.error(
      'ERREUR STATUT DEMANDE :',
      error
    );


    alert(
      error.message ||
      'Impossible de modifier le statut de la demande.'
    );

  }

}

async function deleteMember(id){
  if(!confirm(
    '⚠️ Voulez-vous vraiment supprimer ce membre ?\n\n' +
    'Cette action est définitive.'
  )){
    return;
  }

  try{

    if(!member?.id){
      alert('Vous devez être connecté.');
      return;
    }

    if(String(id)===String(member.id)){
      alert('❌ Vous ne pouvez pas supprimer votre propre compte administrateur.');
      return;
    }
    
// Supprime les affectations de calendrier liées au membre
const { error:calendarAssignmentsError } = await db
  .from('calendar_assignments')
  .delete()
  .eq('member_id', id);

if(calendarAssignmentsError){
  throw calendarAssignmentsError;
}
    
    const {error}=await db
      .from('members')
      .delete()
      .eq('id',id);

    if(error)throw error;

    alert('✅ Membre supprimé.');

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION MEMBRE :',
      error
    );

    alert(
      error.message||
      'Impossible de supprimer le membre.'
    );
  }
}


function newPoll(){
  openModal(`
    <h2>📊 Créer un sondage</h2>

    <div class="field">
      <label>Question</label>
      <input
        id="pollQuestion"
        class="input"
        placeholder="Votre question..."
      >
    </div>

    <div class="field">
      <label>Réponses possibles</label>

      <div id="pollOptions">

        <div class="row poll-option" style="margin-bottom:8px;gap:8px;">
          <input
            class="input poll-option-input"
            placeholder="Réponse 1"
          >
        </div>

        <div class="row poll-option" style="margin-bottom:8px;gap:8px;">
          <input
            class="input poll-option-input"
            placeholder="Réponse 2"
          >
        </div>

      </div>

      <button
        type="button"
        class="ghost"
        onclick="addPollOption()">
        ➕ Ajouter une réponse
      </button>
    </div>

    <div class="field" style="margin-top:18px;">
      <label>Nombre de réponses autorisées</label>

      <label style="display:flex;align-items:center;gap:10px;margin-top:12px;">
        <input
          type="radio"
          name="pollResponseMode"
          id="pollSingleChoice"
          value="false"
          checked
        >
        Une seule réponse
      </label>

      <label style="display:flex;align-items:center;gap:10px;margin-top:10px;">
        <input
          type="radio"
          name="pollResponseMode"
          id="pollMultipleChoice"
          value="true"
        >
        Plusieurs réponses
      </label>
    </div>

    <div class="row" style="margin-top:15px;gap:8px;">

      <button
        type="button"
        class="primary"
        onclick="savePoll()">
        💾 Créer le sondage
      </button>

      <button
        type="button"
        class="ghost"
        onclick="closeModal()">
        Annuler
      </button>

    </div>
  `);
}

function addPollOption(){

  const container=$('pollOptions');

  if(!container)return;

  const number=container.querySelectorAll('.poll-option').length+1;

  const div=document.createElement('div');

  div.className='row poll-option';

  div.style.cssText='margin-bottom:8px;gap:8px;';

  div.innerHTML=`
    <input
      class="input poll-option-input"
      placeholder="Réponse ${number}"
    >

    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove()">
      ❌
    </button>
  `;

  container.appendChild(div);
}


async function savePoll(){
  try{

    const title=$('pollQuestion')?.value.trim()||'';

    const optionInputs=[
      ...document.querySelectorAll('.poll-option-input')
    ];

    const options=optionInputs
      .map(input=>input.value.trim())
      .filter(Boolean);

    if(!title){
      alert('La question est obligatoire.');
      return;
    }

    if(options.length<2){
      alert('Il faut au minimum 2 réponses.');
      return;
    }

    // Récupération du choix unique ou multiple
    const multipleChoices =
      $('pollMultipleChoice')?.checked || false;

    const {data:poll,error:pollError}=await db
      .from('polls')
      .insert({
        title:title,
        description:'',
        multiple_choices:multipleChoices,
        anonymous:false,
        allow_change_vote:false,
        active:true,
        created_by:member.id
      })
      .select()
      .single();

    if(pollError)throw pollError;

    const optionRows=options.map((option_text,index)=>({
      poll_id:poll.id,
      option_text:option_text,
      display_order:index+1
    }));

    const {error:optionsError}=await db
      .from('poll_options')
      .insert(optionRows);

    if(optionsError)throw optionsError;

    // NOTIFICATION PUSH — NOUVEAU SONDAGE

    try{

      const {data:pushData,error:pushError} =
        await db.functions.invoke('send-push', {
          body: {
            all_members:true,
            title:'📊 Nouveau sondage',
            message:`Un nouveau sondage est disponible : ${title}`
          }
        });

      if(pushError){
        console.error('❌ ERREUR PUSH SONDAGE :',pushError);
      }else{
        console.log('✅ PUSH SONDAGE ENVOYÉ :',pushData);
      }

    }catch(pushError){

      console.error('❌ ERREUR PUSH SONDAGE :',pushError);

    }

    closeModal();

    alert('✅ Sondage créé.');

    await renderAdmin();

  }catch(error){

    console.error('ERREUR CRÉATION SONDAGE :',error);

    alert(
      error.message||
      'Impossible de créer le sondage.'
    );
  }
}

// ============================================================
// 🎉 GESTION ADMIN — FESTIVITÉS
// ============================================================

async function showAdminEvents(){

  try{

    const [
      eventsRes,
      membersRes,
      responsesRes
    ] = await Promise.all([

      db
        .from('events')
        .select('id,title,event_date,created_at,active,archived')
        .order('event_date',{ascending:true}),

      db
        .from('members')
        .select('id')
        .eq('active',true),

      db
        .from('event_responses')
        .select('event_id,member_id')

    ]);


    if(eventsRes.error)
      throw eventsRes.error;

    if(membersRes.error)
      throw membersRes.error;

    if(responsesRes.error)
      throw responsesRes.error;


    const events =
      eventsRes.data || [];

    const members =
      membersRes.data || [];

    const responses =
      responsesRes.data || [];


    const totalPeople =
      members.length;


    // --------------------------------------------------------
    // Comptage des réponses par festivité
    // --------------------------------------------------------

    const responseMap = {};

    responses.forEach(response => {

      if(
        !response.event_id ||
        !response.member_id
      ){
        return;
      }


      const key =
        String(response.event_id);


      if(!responseMap[key]){
        responseMap[key] =
          new Set();
      }


      responseMap[key].add(
        String(response.member_id)
      );

    });


    // --------------------------------------------------------
    // Affichage
    // --------------------------------------------------------

    const container =
      $('homeAdmin');


    if(!container){

      console.error(
        'homeAdmin introuvable.'
      );

      return;

    }


    container.innerHTML = `

      <div
        style="
          width:100%;
          max-width:1200px;
          margin:0 auto;
        "
      >

        <div
          class="section-title"
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            flex-wrap:wrap;
          "
        >

          <h2>
            🎉 Gestion des festivités
          </h2>


          <button
            class="primary"
            type="button"
            onclick="newEvent()"
          >
            ➕ Nouvelle festivité
          </button>

        </div>


        <div
          class="grid"
          style="
            margin-top:20px;
          "
        >

          ${
            events.length

            ? events.map(event => {

                const answered =
                  responseMap[
                    String(event.id)
                  ]?.size || 0;


                const percentage =
                  totalPeople > 0
                    ? Math.round(
                        (
                          answered /
                          totalPeople
                        ) * 100
                      )
                    : 0;


                return `

                  <div
                    class="card"
                    style="
                      position:relative;
                    "
                  >

                    <h3>
                      🎉
                      ${esc(
                        event.title ||
                        'Festivité'
                      )}
                    </h3>


                    <p class="muted">

                      📅

                      ${
                        typeof fmtDate ===
                        'function'

                        ? fmtDate(
                            event.event_date
                          )

                        : (
                            event.event_date ||
                            ''
                          )
                      }

                    </p>


                    <p>

                      👥

                      <strong>
                        ${answered}
                      </strong>

                      /

                      ${totalPeople}

                      personnes ont répondu

                    </p>


                    <!-- BARRE D'AVANCEMENT -->

                    <div
                      style="
                        width:100%;
                        height:10px;
                        background:#e5e7eb;
                        border-radius:999px;
                        overflow:hidden;
                        margin:10px 0 16px;
                      "
                    >

                      <div
                        style="
                          width:${percentage}%;
                          height:100%;
                          background:#2563eb;
                          border-radius:999px;
                          transition:width .3s ease;
                        "
                      ></div>

                    </div>


                    <p
                      class="muted"
                      style="
                        margin-top:-8px;
                      "
                    >
                      ${percentage}% de réponses
                    </p>


                    <div
                      class="row"
                      style="
                        display:flex;
                        gap:8px;
                        flex-wrap:wrap;
                      "
                    >

                      <button
                        class="ghost"
                        type="button"
                        onclick="
                          eventRecap(
                            '${event.id}'
                          )
                        "
                      >
                        📋 Voir les réponses
                      </button>

<button
  class="ghost"
  type="button"
  onclick="showEventNonResponders('${event.id}')"
>
  👤 Voir les non-répondants
</button>


                      <button
                        class="ghost"
                        type="button"
                        onclick="
                          editEvent(
                            '${event.id}'
                          )
                        "
                      >
                        ✏️ Modifier
                      </button>


                      <button
                        class="ghost"
                        type="button"
                        onclick="
                          deleteEvent(
                            '${event.id}'
                          )
                        "
                      >
                        🗑️ Supprimer
                      </button>

                    </div>

                  </div>

                `;

              }).join('')

            :

            `

              <div class="card">

                <h3>
                  🎉 Aucune festivité
                </h3>

                <p class="muted">
                  Aucune festivité n'est actuellement créée.
                </p>

              </div>

            `
          }

        </div>

      </div>

    `;


  }catch(error){

    console.error(
      'ERREUR GESTION FESTIVITÉS :',
      error
    );


    alert(
      error?.message ||
      'Impossible de charger les festivités.'
    );

  }

}



// ============================================================
// 📊 GESTION ADMIN — SONDAGES
// ============================================================

// ============================================================
// 📊 GESTION ADMIN — SONDAGES
// ============================================================

async function showAdminPolls(){

  try{

    // --------------------------------------------------------
    // Récupération des sondages
    // --------------------------------------------------------

    const {
      data:polls,
      error:pollsError
    } = await db
      .from('polls')
      .select(`
        id,
        title,
        description,
        multiple_choices,
        active,
        created_at
      `)
      .order(
        'created_at',
        {ascending:false}
      );


    if(pollsError)
      throw pollsError;


    const list =
      polls || [];


    // --------------------------------------------------------
    // Nombre de membres actifs
    // --------------------------------------------------------

    const {
      data:members,
      error:membersError
    } = await db
      .from('members')
      .select('id')
      .eq(
        'active',
        true
      );


    if(membersError)
      throw membersError;


    const totalPeople =
      (members || []).length;


    // --------------------------------------------------------
    // Conteneur
    // --------------------------------------------------------

    const container =
      $('homeAdmin');


    if(!container){

      console.error(
        'homeAdmin introuvable.'
      );

      return;

    }


    // --------------------------------------------------------
    // Titre
    // --------------------------------------------------------

    let html = `

      <div
        style="
          width:100%;
          max-width:1200px;
          margin:0 auto;
        "
      >

        <div
          class="section-title"
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            flex-wrap:wrap;
          "
        >

          <h2>
            📊 Gestion des sondages
          </h2>


          <button
            type="button"
            class="primary"
            onclick="newPoll()"
          >
            ➕ Nouveau sondage
          </button>

        </div>


        <div
          class="grid"
          style="
            margin-top:20px;
          "
        `;


    // --------------------------------------------------------
    // Aucun sondage
    // --------------------------------------------------------

    if(!list.length){

      html += `

        <div class="card">

          <h3>
            📭 Aucun sondage
          </h3>

          <p class="muted">
            Aucun sondage n'est actuellement créé.
          </p>

        </div>

      `;

    }


    // --------------------------------------------------------
    // Sondages
    // --------------------------------------------------------

    for(const poll of list){

      // ------------------------------------------------------
      // Options du sondage
      // ------------------------------------------------------

      const {
        data:options,
        error:optionsError
      } = await db
        .from('poll_options')
        .select(`
          id,
          option_text,
          display_order
        `)
        .eq(
          'poll_id',
          poll.id
        )
        .order(
          'display_order',
          {ascending:true}
        );


      if(optionsError)
        throw optionsError;


      // ------------------------------------------------------
      // Toutes les réponses
      // ------------------------------------------------------

      const {
        data:responses,
        error:responsesError
      } = await db
        .from('poll_responses')
        .select(`
          id,
          member_id,
          option_id
        `)
        .eq(
          'poll_id',
          poll.id
        );


      if(responsesError)
        throw responsesError;


      const responseList =
        responses || [];


      // ------------------------------------------------------
      // Membres ayant répondu
      //
      // Plusieurs choix possibles peuvent créer plusieurs
      // lignes pour une même personne.
      // On utilise donc un Set.
      // ------------------------------------------------------

      const uniqueMembers =
        new Set();


      responseList.forEach(
        response => {

          if(response.member_id){

            uniqueMembers.add(
              String(
                response.member_id
              )
            );

          }

        }
      );


      const answered =
        uniqueMembers.size;


      // ------------------------------------------------------
      // Pourcentage
      // ------------------------------------------------------

      const percentage =
        totalPeople > 0

          ? Math.min(
              100,
              Math.round(
                (
                  answered /
                  totalPeople
                ) * 100
              )
            )

          : 0;


      // ------------------------------------------------------
      // Statut
      // ------------------------------------------------------

      const status =
        poll.active === true

          ? `
              <span
                style="
                  display:inline-flex;
                  align-items:center;
                  gap:5px;
                  padding:5px 9px;
                  border-radius:999px;
                  background:#dcfce7;
                  color:#166534;
                  font-size:13px;
                  font-weight:600;
                "
              >
                🟢 Actif
              </span>
            `

          : `
              <span
                style="
                  display:inline-flex;
                  align-items:center;
                  gap:5px;
                  padding:5px 9px;
                  border-radius:999px;
                  background:#f3f4f6;
                  color:#4b5563;
                  font-size:13px;
                  font-weight:600;
                "
              >
                ⚪ Inactif
              </span>
            `;


      // ------------------------------------------------------
      // Date
      // ------------------------------------------------------

      let createdDate = '';

      if(poll.created_at){

        try{

          createdDate =
            new Date(
              poll.created_at
            ).toLocaleDateString(
              'fr-FR',
              {
                day:'2-digit',
                month:'2-digit',
                year:'numeric'
              }
            );

        }catch{

          createdDate =
            poll.created_at;

        }

      }


      // ------------------------------------------------------
      // Options
      // ------------------------------------------------------

      const optionCount =
        (options || []).length;


      // ------------------------------------------------------
      // Carte
      // ------------------------------------------------------

      html += `

        <div
          class="card"
          style="
            position:relative;
          "
        >

          <div
            style="
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap:12px;
              flex-wrap:wrap;
            "
          >

            <div>

              <h3
                style="
                  margin:0 0 6px 0;
                "
              >

                📊

                ${esc(
                  poll.title ||
                  'Sondage'
                )}

              </h3>


              ${
                poll.description

                ? `

                  <p
                    class="muted"
                    style="
                      margin:0;
                    "
                  >
                    ${esc(
                      poll.description
                    )}
                  </p>

                `

                : ''
              }

            </div>


            ${status}

          </div>


          <div
            style="
              display:flex;
              gap:12px;
              flex-wrap:wrap;
              margin-top:15px;
            "
          >

            <div
              style="
                padding:10px 14px;
                border-radius:12px;
                background:#f8fafc;
              "
            >

              <strong>
                👥 ${answered}/${totalPeople}
              </strong>

              <div
                class="muted"
                style="
                  font-size:12px;
                  margin-top:3px;
                "
              >
                réponses
              </div>

            </div>


            <div
              style="
                padding:10px 14px;
                border-radius:12px;
                background:#f8fafc;
              "
            >

              <strong>
                📝 ${optionCount}
              </strong>

              <div
                class="muted"
                style="
                  font-size:12px;
                  margin-top:3px;
                "
              >
                choix
              </div>

            </div>


            <div
              style="
                padding:10px 14px;
                border-radius:12px;
                background:#f8fafc;
              "
            >

              <strong>
                📅 ${createdDate}
              </strong>

              <div
                class="muted"
                style="
                  font-size:12px;
                  margin-top:3px;
                "
              >
                création
              </div>

            </div>

          </div>


          <!-- BARRE D'AVANCEMENT -->

          <div
            style="
              margin-top:18px;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:6px;
              "
            >

              <span
                style="
                  font-size:13px;
                  font-weight:600;
                "
              >
                Avancement
              </span>


              <span
                style="
                  font-size:13px;
                  font-weight:700;
                "
              >
                ${percentage}%
              </span>

            </div>


            <div
              style="
                width:100%;
                height:10px;
                background:#e5e7eb;
                border-radius:999px;
                overflow:hidden;
              "
            >

              <div
                style="
                  width:${percentage}%;
                  height:100%;
                  background:#2563eb;
                  border-radius:999px;
                  transition:width .3s ease;
                "
              ></div>

            </div>

          </div>


          <!-- ACTIONS -->

          <div
            style="
              display:flex;
              gap:8px;
              flex-wrap:wrap;
              margin-top:18px;
            "
          >

            <button
              type="button"
              class="ghost"
              onclick="
                pollRecap(
                  '${poll.id}'
                )
              "
            >
              📋 Voir les résultats
            </button>


            <button
              type="button"
              class="ghost"
              onclick="
                editPoll(
                  '${poll.id}'
                )
              "
            >
              ✏️ Modifier
            </button>


            <button
              type="button"
              class="ghost"
              onclick="
                deletePoll(
                  '${poll.id}'
                )
              "
            >
              🗑️ Supprimer
            </button>

          </div>

        </div>

      `;

    }


    html += `

        </div>

      </div>

    `;


    container.innerHTML =
      html;


  }catch(error){

    console.error(
      'ERREUR GESTION SONDAGES :',
      error
    );


    alert(
      error?.message ||
      'Impossible de charger les sondages.'
    );

  }

}


// ============================================================
// 🌐 DISPONIBILITÉ GLOBALE
// ============================================================

window.showAdminPolls =
  showAdminPolls;


async function pollRecap(id){

  try{

    const {data:poll,error:pollError}=await db
      .from('polls')
      .select('*')
      .eq('id',id)
      .single();

    if(pollError)throw pollError;

    const {data:responses,error:responseError}=await db
      .from('poll_responses')
      .select(`
        id,
        option_id,
        member_id,
        members(first_name,last_name),
        poll_options(option_text)
      `)
      .eq('poll_id',id);

    if(responseError)throw responseError;

    const list=responses||[];

    const counts={};

    list.forEach(r=>{
      const option=r.poll_options?.option_text||'Réponse inconnue';

      counts[option]=(counts[option]||0)+1;
    });

    const people=list.map(r=>{

      const m=r.members||{};

      const name=
        `${m.first_name||''} ${m.last_name||''}`.trim()
        ||'Membre inconnu';

      const answer=
        r.poll_options?.option_text
        ||'Réponse inconnue';

      return `
        <tr>
          <td>${esc(name)}</td>
          <td>${esc(answer)}</td>
        </tr>
      `;

    }).join('');

    const totals=Object.entries(counts)
      .map(([answer,count])=>`
        <p>
          <strong>${esc(answer)}</strong> :
          ${count} réponse${count>1?'s':''}
        </p>
      `)
      .join('');

    openModal(`

      <h2>📋 Récapitulatif du sondage</h2>

      <h3>${esc(poll.question||'')}</h3>

      <p>
        👥 Nombre de réponses :
        <strong>${list.length}</strong>
      </p>

      <hr>

      <h3>👤 Réponses des membres</h3>

      ${
        list.length
        ? `
          <div class="table-wrap">

            <table class="table">

              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Réponse</th>
                </tr>
              </thead>

              <tbody>
                ${people}
              </tbody>

            </table>

          </div>
        `
        : '<p>Aucune réponse pour le moment.</p>'
      }

      <hr>

      <h3>📊 Comptage par réponse</h3>

      ${
        totals||
        '<p>Aucune réponse pour le moment.</p>'
      }

      <div class="row" style="margin-top:15px;">

<button
  type="button"
  class="ghost"
  onclick="printCurrentModal()">

  🖨️ Imprimer

</button>

        <button
          type="button"
          class="primary"
          onclick="closeModal()">
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR RÉCAPITULATIF SONDAGE :',
      error
    );

    alert(
      error.message||
      'Impossible de charger le récapitulatif.'
    );
  }
}

window.pollRecap = pollRecap;

async function togglePoll(id,active){

  try{

    const {error}=await db
      .from('polls')
      .update({active})
      .eq('id',id);

    if(error)throw error;

    await renderAdmin();

  }catch(error){

    console.error('ERREUR STATUT SONDAGE :',error);

    alert(
      error.message||
      'Impossible de modifier le sondage.'
    );
  }
}

async function deletePoll(id){

  if(!confirm(
    'Voulez-vous vraiment supprimer ce sondage ?'
  )){
    return;
  }

  try{

    const {error}=await db
      .from('polls')
      .delete()
      .eq('id',id);

    if(error)throw error;

    alert('✅ Sondage supprimé.');

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION SONDAGE :',
      error
    );

    alert(
      error.message||
      'Impossible de supprimer le sondage.'
    );
  }
}



function renderMaterialRequests(reqs){
  return `<div class="section-title"><h2>📋 Demandes de matériel</h2></div>
  <div class="card table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Membre</th>
          <th>🧰 Matériel</th>
          <th>Début</th>
          <th>Retour</th>
          <th>Motif</th>
          <th>Commentaire</th>
          <th>Statut</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${(reqs||[]).map(r=>{
          const membre=r.members||{};
          const nomMembre=`${membre.first_name||''} ${membre.last_name||''}`.trim()||'Membre inconnu';

          const materiels=(r.material_request_items||[])
            .map(item=>`${item.materials?.name||'Matériel inconnu'} × ${Number(item.quantity||1)}`)
            .join(', ')||'—';

          const statut=
            r.status==='approved'
              ? '✅ Acceptée'
              : r.status==='refused'
                ? '❌ Refusée'
                : '⏳ En attente';

          return `
            <tr>
              <td><strong>${esc(nomMembre)}</strong></td>

              <td>
                🧰 <strong>${esc(materiels)}</strong>
              </td>

              <td>${fmtDate(r.start_date)}</td>

              <td>${fmtDate(r.return_date)}</td>

              <td>${esc(r.reason||'—')}</td>

              <td>${esc(r.comment||'—')}</td>

              <td>${statut}</td>

              <td>
                ${
                  r.status==='pending'
                  ? `
                    <button class="ghost"
                      onclick="setRequestStatus('${r.id}','approved')">
                      ✅ Accepter
                    </button>

                    <button class="ghost"
                      onclick="setRequestStatus('${r.id}','refused')">
                      ❌ Refuser
                    </button>
                  `
                  : ''
                }

                <button class="ghost"
                  onclick="deleteAdminMaterialRequest('${r.id}')">
                  🗑️ Supprimer
                </button>
              </td>
            </tr>
          `;
        }).join('') || `
          <tr>
            <td colspan="8" style="text-align:center">
              Aucune demande.
            </td>
          </tr>
        `}
      </tbody>
    </table>
  </div>`;
}

async function setIdeaStatus(id,status){
  try{
    const {error}=await db.from('ideas').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    await renderAdmin();
  }catch(error){console.error(error);alert(error.message||'Impossible de modifier cette idée.');}
}


async function deleteAdminMaterialRequest(id){
  if(!confirm('⚠️ Voulez-vous vraiment supprimer cette demande de matériel ?')){
    return;
  }

  try{
    // Supprimer d'abord les lignes associées
    const {error:itemError}=await db
      .from('material_request_items')
      .delete()
      .eq('request_id',id);

    if(itemError)throw itemError;

    // Puis supprimer la demande
    const {error}=await db
      .from('material_requests')
      .delete()
      .eq('id',id);

    if(error)throw error;

    alert('✅ La demande de matériel a été supprimée.');

    await renderAdmin();

  }catch(error){
    console.error('ERREUR SUPPRESSION DEMANDE MATÉRIEL :',error);
    alert(error.message||'Impossible de supprimer la demande.');
  }
}

async function deleteIdea(id){
  if(!confirm('Supprimer cette idée ?'))return;
  try{
    const {error}=await db.from('ideas').delete().eq('id',id);
    if(error)throw error;
    await renderAdmin();
  }catch(error){alert(error.message||'Impossible de supprimer cette idée.');}
}
let materialCalendarDate = new Date();

function materialStatusLabel(status){

  if(status === 'approved')
    return '✅ Acceptée';

  if(status === 'refused')
    return '❌ Refusée';

  return '⏳ En attente';
}


function materialStatusStyle(status){

  if(status === 'approved')
    return 'border-left:4px solid #16a34a;background:#f0fdf4;';

  if(status === 'refused')
    return 'border-left:4px solid #dc2626;background:#fef2f2;';

  return 'border-left:4px solid #f59e0b;background:#fffbeb;';
}


/* =====================================================
   📋 FICHE MATÉRIEL
===================================================== */

async function showMaterialSheet(){

  try{

    const { data: materials, error } = await db
      .from('materials')
      .select('*')
      .order('name', { ascending:true });

    if(error) throw error;

    const list = materials || [];

    openModal(`

      <h2>📋 Fiche matériel</h2>

      <p class="muted">
        ${list.length}
        matériel${list.length > 1 ? 's' : ''}
        enregistré${list.length > 1 ? 's' : ''}.
      </p>

      ${
        list.length
        ? `

          <div style="
            display:grid;
            gap:12px;
            margin-top:15px;
          ">

            ${list.map(m => `

              <div class="card" style="margin:0;">

                <div style="
                  display:flex;
                  justify-content:space-between;
                  gap:12px;
                  align-items:flex-start;
                  flex-wrap:wrap;
                ">

                  <div>

                    <h3 style="margin:0 0 6px 0;">
                      🧰 ${esc(m.name || 'Matériel')}
                    </h3>

                    <p class="muted" style="margin:0 0 5px 0;">
                      ${esc(
                        m.description ||
                        'Aucune description'
                      )}
                    </p>

                    <p style="margin:0;">
                      Quantité :
                      <strong>
                        ${Number(m.quantity || 0)}
                      </strong>
                    </p>

                    <p style="margin:4px 0 0 0;">

                      ${
                        m.available
                        ? `
                          <span style="
                            color:#15803d;
                            font-weight:700;
                          ">
                            🟢 Disponible
                          </span>
                        `
                        : `
                          <span style="
                            color:#b91c1c;
                            font-weight:700;
                          ">
                            🔴 Indisponible
                          </span>
                        `
                      }

                      ${
                        m.loan_allowed
                        ? `
                          <span class="muted">
                            · Prêt autorisé
                          </span>
                        `
                        : `
                          <span class="muted">
                            · Prêt non autorisé
                          </span>
                        `
                      }

                    </p>

                  </div>


                  <div style="
                    display:flex;
                    gap:7px;
                    flex-wrap:wrap;
                  ">

                    <button
                      type="button"
                      class="ghost"
                      onclick="viewMaterial('${m.id}')"
                    >
                      👁️ Consulter
                    </button>


                    <button
                      type="button"
                      class="ghost"
                      onclick="editMaterial('${m.id}')"
                    >
                      ✏️ Modifier
                    </button>


                    <button
                      type="button"
                      class="ghost"
                      onclick="
                        toggleMaterialAvailability(
                          '${m.id}',
                          ${m.available ? 'false' : 'true'}
                        )
                      "
                    >

                      ${
                        m.available
                        ? '🔴 Rendre indisponible'
                        : '🟢 Rendre disponible'
                      }

                    </button>


                    <button
                      type="button"
                      class="ghost"
                      onclick="deleteMaterial('${m.id}')"
                    >
                      🗑️ Supprimer
                    </button>

                  </div>

                </div>

              </div>

            `).join('')}

          </div>

        `
        : `
          <div class="card">
            <p>Aucun matériel enregistré.</p>
          </div>
        `
      }

      <div class="row" style="margin-top:15px;">

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR FICHE MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger les matériels.'
    );

  }

}


/* =====================================================
   👁️ CONSULTER UN MATÉRIEL
===================================================== */

async function viewMaterial(id){

  try{

    const { data:m, error } = await db
      .from('materials')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if(error) throw error;

    if(!m){

      alert('Matériel introuvable.');

      return;

    }

    openModal(`

      <h2>
        🧰 ${esc(m.name || 'Matériel')}
      </h2>

      <div class="card">

        <p>
          <strong>Description :</strong><br>
          ${esc(
            m.description ||
            'Aucune description'
          )}
        </p>

        <p>
          <strong>Quantité :</strong>
          ${Number(m.quantity || 0)}
        </p>

        <p>
          <strong>État :</strong>
          ${
            m.available
            ? '🟢 Disponible'
            : '🔴 Indisponible'
          }
        </p>

        <p>
          <strong>Prêt :</strong>
          ${
            m.loan_allowed
            ? '✅ Autorisé'
            : '❌ Non autorisé'
          }
        </p>

      </div>

      <div class="row">

        <button
          type="button"
          class="ghost"
          onclick="editMaterial('${m.id}')"
        >
          ✏️ Modifier
        </button>

        <button
          type="button"
          class="ghost"
          onclick="
            toggleMaterialAvailability(
              '${m.id}',
              ${m.available ? 'false' : 'true'}
            )
          "
        >
          ${
            m.available
            ? '🔴 Rendre indisponible'
            : '🟢 Rendre disponible'
          }
        </button>

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR CONSULTATION MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de consulter le matériel.'
    );

  }

}


/* =====================================================
   🟢 / 🔴 DISPONIBILITÉ
===================================================== */

async function toggleMaterialAvailability(
  id,
  available
){

  try{

    const value =
      available === true ||
      available === 'true';

    const { error } = await db
      .from('materials')
      .update({
        available:value
      })
      .eq('id',id);

    if(error) throw error;

    closeModal();

    alert(
      value
      ? '🟢 Matériel rendu disponible.'
      : '🔴 Matériel rendu indisponible.'
    );

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR DISPONIBILITÉ MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de modifier la disponibilité.'
    );

  }

}


/* =====================================================
   📅 CHARGEMENT CALENDRIER
===================================================== */

async function loadMaterialCalendarRequests(){

  const [
    reqRes,
    itemRes,
    memberRes,
    materialRes
  ] = await Promise.all([

    db
      .from('material_requests')
      .select(`
        id,
        member_id,
        start_date,
        return_date,
        status,
        reason,
        comment,
        created_at
      `)
      .order('start_date',{
        ascending:true
      }),

    db
      .from('material_request_items')
      .select(`
        request_id,
        material_id,
        quantity
      `),

    db
      .from('members')
      .select(`
        id,
        first_name,
        last_name
      `),

    db
      .from('materials')
      .select(`
        id,
        name
      `)

  ]);

  if(reqRes.error)
    throw reqRes.error;

  if(itemRes.error)
    throw itemRes.error;

  if(memberRes.error)
    throw memberRes.error;

  if(materialRes.error)
    throw materialRes.error;


  const membersMap = {};
  const materialsMap = {};


  (memberRes.data || []).forEach(
    m => {
      membersMap[String(m.id)] = m;
    }
  );


  (materialRes.data || []).forEach(
    m => {
      materialsMap[String(m.id)] = m;
    }
  );


  const itemsByRequest = {};


  (itemRes.data || []).forEach(item => {

    const key =
      String(item.request_id);

    if(!itemsByRequest[key])
      itemsByRequest[key] = [];

    itemsByRequest[key].push({

      quantity:item.quantity,

      material:
        materialsMap[
          String(item.material_id)
        ] || null

    });

  });


  return (reqRes.data || []).map(r => ({

    ...r,

    member:
      membersMap[
        String(r.member_id)
      ] || null,

    items:
      itemsByRequest[
        String(r.id)
      ] || []

  }));

}


/* =====================================================
   📅 CALENDRIER MATÉRIEL
===================================================== */

function materialDateKey(value){

  const d = new Date(value);

  return `${d.getFullYear()}-${
    String(d.getMonth()+1).padStart(2,'0')
  }-${
    String(d.getDate()).padStart(2,'0')
  }`;

}


function renderMaterialCalendar(
  monthDate,
  requests
){

  const year =
    monthDate.getFullYear();

  const month =
    monthDate.getMonth();

  const first =
    new Date(year,month,1);

  const last =
    new Date(year,month+1,0);

  const startOffset =
    (first.getDay()+6)%7;

  const days =
    last.getDate();

  const monthName =
    first.toLocaleDateString(
      'fr-FR',
      {
        month:'long',
        year:'numeric'
      }
    );


  const events = [];


  (requests || []).forEach(r => {

    const start =
      new Date(r.start_date);

    const end =
      new Date(
        r.return_date ||
        r.start_date
      );

    if(
      Number.isNaN(start.getTime())
    )
      return;


    const cursor =
      new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );

    const endDay =
      new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
      );


    while(cursor <= endDay){

      if(
        cursor.getFullYear() === year &&
        cursor.getMonth() === month
      ){

        events.push({

          date:
            materialDateKey(cursor),

          request:r

        });

      }

      cursor.setDate(
        cursor.getDate()+1
      );

    }

  });


  const byDay = {};


  events.forEach(e => {

    if(!byDay[e.date])
      byDay[e.date] = [];

    byDay[e.date].push(
      e.request
    );

  });


  let cells = '';


  for(
    let i=0;
    i<startOffset;
    i++
  ){

    cells += `
      <div style="
        min-height:105px;
        border:1px solid #e5e7eb;
        border-radius:10px;
        background:#f8fafc;
      "></div>
    `;

  }


  for(
    let day=1;
    day<=days;
    day++
  ){

    const key =
      `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const dayRequests =
      [
        ...new Map(
          (byDay[key] || [])
          .map(
            r => [r.id,r]
          )
        ).values()
      ];


    cells += `

      <div style="
        min-height:105px;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:8px;
        background:#fff;
      ">

        <div style="
          font-weight:700;
          margin-bottom:6px;
        ">
          ${day}
        </div>

        ${
          dayRequests.length
          ? dayRequests.map(r => {

              const memberName =
                `${
                  r.member?.first_name || ''
                } ${
                  r.member?.last_name || ''
                }`
                .trim()
                ||
                'Membre inconnu';


              const names =
                r.items
                .map(
                  i =>
                    `${
                      i.material?.name ||
                      'Matériel'
                    } × ${
                      Number(
                        i.quantity || 1
                      )
                    }`
                )
                .join(', ')
                ||
                'Matériel';


              return `

                <button
                  type="button"
                  onclick="
                    showMaterialRequestDetails(
                      '${r.id}'
                    )
                  "
                  style="
                    display:block;
                    width:100%;
                    text-align:left;
                    border:0;
                    border-radius:7px;
                    padding:6px;
                    margin-bottom:4px;
                    cursor:pointer;
                    ${materialStatusStyle(r.status)}
                    font-size:12px;
                  "
                >

                  ${esc(names)}

                  <br>

                  <span style="
                    font-weight:600;
                  ">
                    ${esc(memberName)}
                  </span>

                </button>

              `;

            }).join('')

          : `
            <span
              class="muted"
              style="font-size:12px;"
            >
              Aucun prêt
            </span>
          `
        }

      </div>

    `;

  }


  return `

    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      flex-wrap:wrap;
    ">

      <button
        type="button"
        class="ghost"
        onclick="changeMaterialCalendarMonth(-1)"
      >
        ◀
      </button>

      <h3 style="
        margin:0;
        text-transform:capitalize;
      ">
        📅 ${monthName}
      </h3>

      <button
        type="button"
        class="ghost"
        onclick="changeMaterialCalendarMonth(1)"
      >
        ▶
      </button>

    </div>


    <div style="
      display:grid;
      grid-template-columns:
        repeat(7,minmax(0,1fr));
      gap:6px;
      margin-top:12px;
    ">

      ${
        [
          'Lun',
          'Mar',
          'Mer',
          'Jeu',
          'Ven',
          'Sam',
          'Dim'
        ]
        .map(
          d => `
            <div style="
              font-weight:700;
              text-align:center;
              padding:6px;
            ">
              ${d}
            </div>
          `
        )
        .join('')
      }

      ${cells}

    </div>


    <div style="
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      margin-top:14px;
      font-size:13px;
    ">

      <span>🟢 Acceptée</span>
      <span>🟠 En attente</span>
      <span>🔴 Refusée</span>

    </div>


    <div style="
      margin-top:15px;
      max-height:260px;
      overflow:auto;
    ">

      ${
        requests
        .filter(r => {

          const d =
            new Date(r.start_date);

          return (
            d.getFullYear() === year &&
            d.getMonth() === month
          );

        })
        .map(r => {

          const memberName =
            `${
              r.member?.first_name || ''
            } ${
              r.member?.last_name || ''
            }`
            .trim()
            ||
            'Membre inconnu';


          const names =
            r.items
            .map(
              i =>
                `${
                  i.material?.name ||
                  'Matériel'
                } × ${
                  Number(
                    i.quantity || 1
                  )
                }`
            )
            .join(', ')
            ||
            'Matériel';


          return `

            <button
              type="button"
              onclick="
                showMaterialRequestDetails(
                  '${r.id}'
                )
              "
              style="
                width:100%;
                text-align:left;
                border:0;
                border-radius:9px;
                padding:10px;
                margin-bottom:7px;
                cursor:pointer;
                ${materialStatusStyle(r.status)}
              "
            >

              <strong>
                ${esc(names)}
              </strong>

              —
              ${esc(memberName)}

              <br>

              <span class="muted">

                ${fmtDate(r.start_date)}
                →
                ${fmtDate(r.return_date)}

                ·

                ${materialStatusLabel(r.status)}

              </span>

            </button>

          `;

        })
        .join('')

        ||
        '<p class="muted">Aucun prêt ce mois-ci.</p>'
      }

    </div>

  `;

}


async function showMaterialCalendar(){

  try{

    const requests =
      await loadMaterialCalendarRequests();

    materialCalendarDate =
      new Date();

    openModal(`

      <h2>
        📅 Calendrier matériel
      </h2>

      <p class="muted">
        Historique des demandes passées
        et des réservations futures.
      </p>

      <div id="materialCalendarContent">

        ${
          renderMaterialCalendar(
            materialCalendarDate,
            requests
          )
        }

      </div>

<div class="row" style="margin-top:15px;">

  <button
    type="button"
    class="primary"
    onclick="closeModal()"
  >
    Fermer
  </button>

</div>
    `);

    window._materialCalendarRequests =
      requests;

  }catch(error){

    console.error(
      'ERREUR CALENDRIER MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger le calendrier matériel.'
    );

  }

}


function changeMaterialCalendarMonth(delta){

  materialCalendarDate =
    new Date(
      materialCalendarDate.getFullYear(),
      materialCalendarDate.getMonth()+delta,
      1
    );


  const container =
    $('materialCalendarContent');


  if(container){

    container.innerHTML =
      renderMaterialCalendar(
        materialCalendarDate,
        window._materialCalendarRequests || []
      );

  }

}


function showMaterialRequestDetails(
  requestId
){

  const r =
    (
      window._materialCalendarRequests || []
    )
    .find(
      x =>
        String(x.id) ===
        String(requestId)
    );


  if(!r)
    return;


  const memberName =
    `${
      r.member?.first_name || ''
    } ${
      r.member?.last_name || ''
    }`
    .trim()
    ||
    'Membre inconnu';


  const names =
    r.items
    .map(
      i =>
        `${
          i.material?.name ||
          'Matériel'
        } × ${
          Number(
            i.quantity || 1
          )
        }`
    )
    .join(', ')
    ||
    '—';


  openModal(`

    <h2>
      📋 Détail du prêt
    </h2>

    <div class="card">

      <p>
        <strong>Membre :</strong>
        ${esc(memberName)}
      </p>

      <p>
        <strong>Matériel :</strong>
        ${esc(names)}
      </p>

      <p>
        <strong>Début :</strong>
        ${fmtDate(r.start_date)}
      </p>

      <p>
        <strong>Retour :</strong>
        ${fmtDate(r.return_date)}
      </p>

      <p>
        <strong>Statut :</strong>
        ${materialStatusLabel(r.status)}
      </p>

      <p>
        <strong>Motif :</strong>
        ${esc(r.reason || '—')}
      </p>

      <p>
        <strong>Commentaire :</strong>
        ${esc(r.comment || '—')}
      </p>

    </div>

  <div
  class="row"
  style="
    margin-top:15px;
    display:flex;
    gap:8px;
    flex-wrap:wrap;
  "
>

  <button
    type="button"
    class="primary"
    onclick="
      closeModal();
      showMaterialCalendar()
    "
  >
    ← Retour au calendrier
  </button>


  <button
    type="button"
    class="ghost"
    style="
      color:#b91c1c;
      border-color:#b91c1c;
    "
    onclick="
      deleteMaterialLoan('${r.id}')
    "
  >
    🗑️ Supprimer le prêt
  </button>

</div>

  `);

}


/* =====================================================
   ➕ AJOUTER UN MATÉRIEL
===================================================== */

async function newMaterial(){

  openModal(`

    <h2>
      🧰 Ajouter un matériel
    </h2>

    <div class="field">

      <label>Nom</label>

      <input
        id="materialName"
        class="input"
        placeholder="Ex : TONNELLES"
      >

    </div>


    <div class="field">

      <label>Description</label>

      <textarea
        id="materialDescription"
        class="textarea"
      ></textarea>

    </div>


    <div class="field">

      <label>Quantité</label>

      <input
        id="materialQuantity"
        class="input"
        type="number"
        min="0"
        value="1"
      >

    </div>


    <label class="check">

      <input
        id="materialAvailable"
        type="checkbox"
        checked
      >

      Disponible

    </label>


    <label class="check">

      <input
        id="materialLoanAllowed"
        type="checkbox"
        checked
      >

      Prêt autorisé

    </label>


    <div class="row">

      <button
        class="primary"
        onclick="saveMaterial()"
      >
        💾 Enregistrer
      </button>

      <button
        class="ghost"
        onclick="closeModal()"
      >
        Annuler
      </button>

    </div>

  `);

}


async function saveMaterial(){

  try{

    const name =
      $('materialName')?.value.trim() || '';

    const description =
      $('materialDescription')?.value.trim() || '';

    const quantity =
      Number(
        $('materialQuantity')?.value || 0
      );

    const available =
      $('materialAvailable')?.checked ?? true;

    const loan_allowed =
      $('materialLoanAllowed')?.checked ?? true;


    if(!name){

      alert(
        'Veuillez saisir le nom du matériel.'
      );

      return;

    }


    if(quantity < 0){

      alert(
        'La quantité ne peut pas être négative.'
      );

      return;

    }


    const { error } =
      await db
        .from('materials')
        .insert({

          name,
          description,
          quantity,
          available,
          loan_allowed

        });


    if(error)
      throw error;


    closeModal();

    alert(
      '✅ Matériel ajouté.'
    );

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR AJOUT MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible d’ajouter le matériel.'
    );

  }

}


/* =====================================================
   ✏️ MODIFIER UN MATÉRIEL
===================================================== */

async function editMaterial(id){

  try{

    const { data:m, error } =
      await db
        .from('materials')
        .select('*')
        .eq('id',id)
        .single();


    if(error)
      throw error;


    openModal(`

      <h2>
        ✏️ Modifier le matériel
      </h2>

      <div class="field">

        <label>Nom</label>

        <input
          id="materialName"
          class="input"
          value="${esc(m.name || '')}"
        >

      </div>


      <div class="field">

        <label>Description</label>

        <textarea
          id="materialDescription"
          class="textarea"
        >${esc(m.description || '')}</textarea>

      </div>


      <div class="field">

        <label>Quantité</label>

        <input
          id="materialQuantity"
          class="input"
          type="number"
          min="0"
          value="${Number(m.quantity || 0)}"
        >

      </div>


      <label class="check">

        <input
          id="materialAvailable"
          type="checkbox"
          ${m.available ? 'checked' : ''}
        >

        Disponible

      </label>


      <label class="check">

        <input
          id="materialLoanAllowed"
          type="checkbox"
          ${m.loan_allowed ? 'checked' : ''}
        >

        Prêt autorisé

      </label>


      <div class="row">

        <button
          class="primary"
          onclick="updateMaterial('${m.id}')"
        >
          💾 Enregistrer
        </button>

        <button
          class="ghost"
          onclick="closeModal()"
        >
          Annuler
        </button>

      </div>

    `);

  }catch(error){

    console.error(error);

    alert(
      error.message ||
      'Impossible de charger le matériel.'
    );

  }

}


async function updateMaterial(id){

  try{

    const name =
      $('materialName')?.value.trim() || '';

    const description =
      $('materialDescription')?.value.trim() || '';

    const quantity =
      Number(
        $('materialQuantity')?.value || 0
      );

    const available =
      $('materialAvailable')?.checked ?? false;

    const loan_allowed =
      $('materialLoanAllowed')?.checked ?? false;


    if(!name){

      alert(
        'Veuillez saisir le nom du matériel.'
      );

      return;

    }


    const { error } =
      await db
        .from('materials')
        .update({

          name,
          description,
          quantity,
          available,
          loan_allowed

        })
        .eq('id',id);


    if(error)
      throw error;


    closeModal();

    alert(
      '✅ Matériel modifié.'
    );

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR MODIFICATION MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de modifier le matériel.'
    );

  }

}


/* =====================================================
   🗑️ SUPPRIMER UN MATÉRIEL
===================================================== */

async function deleteMaterial(id){

  if(
    !confirm(
      'Supprimer ce matériel ?'
    )
  )
    return;


  try{

    const { error } =
      await db
        .from('materials')
        .delete()
        .eq('id',id);


    if(error)
      throw error;


    alert(
      '🗑️ Matériel supprimé.'
    );

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION MATÉRIEL :',
      error
    );

    alert(
      error.message ||
      'Impossible de supprimer le matériel.'
    );

  }

}
async function deleteMaterialLoan(requestId){

  const confirmed = confirm(
    '⚠️ Supprimer définitivement ce prêt ?'
  );

  if(!confirmed) return;

  try{

    const { error: itemsError } = await db
      .from('material_request_items')
      .delete()
      .eq('request_id', requestId);

    if(itemsError) throw itemsError;

    const { error: requestError } = await db
      .from('material_requests')
      .delete()
      .eq('id', requestId);

    if(requestError) throw requestError;

    closeModal();

    alert('🗑️ Le prêt a été supprimé.');

    await showMaterialCalendar();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION PRÊT :',
      error
    );

    alert(
      error.message ||
      'Impossible de supprimer le prêt.'
    );

  }
}

window.deleteMaterialLoan = deleteMaterialLoan;

/* =====================================================
   AJOUT D'UN MEMBRE
   ===================================================== */

async function newMember(){

  openModal(`

    <h2>👤 Ajouter un membre</h2>

    <!-- IDENTITÉ -->

    <h3 style="margin-top:20px;">
      👤 Informations personnelles
    </h3>

    <div class="form-grid">

      <div>
        <label>Prénom *</label>
        <input
          id="memberFirstName"
          class="input"
          type="text">
      </div>

      <div>
        <label>Nom *</label>
        <input
          id="memberLastName"
          class="input"
          type="text">
      </div>

      <div>
        <label>Date de naissance</label>
        <input
          id="memberBirthDate"
          class="input"
          type="date">
      </div>

      <div>
        <label>Sexe</label>

        <select
          id="memberGender"
          class="select">

          <option value="">-- Choisir --</option>
          <option value="homme">Homme</option>
          <option value="femme">Femme</option>

        </select>

      </div>

    </div>


    <!-- PARCOURS SAPEURS-POMPIERS -->

    <h3 style="margin-top:25px;">
      🚒 Parcours sapeur-pompier
    </h3>

    <div class="form-grid">

      <div>
        <label>Date d'entrée chez les SP</label>

        <input
          id="memberSpEntryDate"
          class="input"
          type="date">

      </div>


      <div>

        <label>Statut</label>

        <select
          id="memberStatus"
          class="select">

          <option value="actif">
            🟢 Actif
          </option>

          <option value="retraite">
            ⚪ Retraité
          </option>

        </select>

      </div>


      <div>

        <label>Ancien JSP ?</label>

        <select
          id="memberWasJsp"
          class="select">

          <option value="false">
            Non
          </option>

          <option value="true">
            Oui
          </option>

        </select>

      </div>


      <div>

        <label>Membre du bureau ?</label>

        <select
          id="memberBureau"
          class="select">

          <option value="false">
            Non
          </option>

          <option value="true">
            Oui
          </option>

        </select>

      </div>

    </div>


    <!-- INACTIVITÉ -->

    <h3 style="margin-top:25px;">
      ⏸️ Périodes d'inactivité
    </h3>

    <p class="muted">
      Ajoutez une ou plusieurs périodes d'inactivité.
    </p>

    <div id="inactivityContainer"></div>

    <button
      type="button"
      class="ghost"
      onclick="addMemberInactivity()"
      style="margin-top:8px;">

      ➕ Ajouter une période d'inactivité

    </button>


    <!-- ENFANTS -->

    <h3 style="margin-top:25px;">
      👨‍👩‍👧‍👦 Enfants
    </h3>

    <div class="field">

      <label>Nombre d'enfants</label>

      <input
        id="memberChildrenCount"
        class="input"
        type="number"
        min="0"
        value="0"
        onchange="renderMemberChildren()"
        oninput="renderMemberChildren()">

    </div>

    <div id="childrenContainer"></div>


    <!-- COMPTE -->

    <h3 style="margin-top:25px;">
      🔐 Compte de connexion
    </h3>

    <div class="form-grid">

      <div>

        <label>Code d'accès *</label>

        <input
          id="memberCode"
          class="input"
          type="text">

      </div>


      <div>

        <label>Rôle</label>

        <select
          id="memberRole"
          class="select">

          <option value="user">
            Utilisateur
          </option>

          <option value="admin">
            Administrateur
          </option>

        </select>

      </div>

    </div>


    <div class="row" style="margin-top:25px;">

      <button
        type="button"
        class="primary"
        onclick="saveMember()">

        💾 Enregistrer le membre

      </button>


      <button
        type="button"
        class="ghost"
        onclick="closeModal()">

        Annuler

      </button>

    </div>

  `);

}


/* =====================================================
   AJOUT D'UNE PÉRIODE D'INACTIVITÉ
   ===================================================== */

function addMemberInactivity(){

  const container =
    $('inactivityContainer');

  if(!container) return;


  const div =
    document.createElement('div');

  div.className = 'card';

  div.style.marginTop = '10px';


  div.innerHTML = `

    <div class="form-grid">

      <div>

        <label>Début</label>

        <input
          class="input inactivity-start"
          type="date">

      </div>


      <div>

        <label>Fin</label>

        <input
          class="input inactivity-end"
          type="date">

      </div>

    </div>


    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove()"
      style="margin-top:8px;">

      🗑️ Supprimer cette période

    </button>

  `;


  container.appendChild(div);

}


/* =====================================================
   AFFICHAGE DES ENFANTS
   ===================================================== */

function renderMemberChildren(){

  const container =
    $('childrenContainer');

  const count =
    Number(
      $('memberChildrenCount')?.value || 0
    );


  if(!container) return;


  container.innerHTML = '';


  if(count <= 0){

    return;

  }


  for(let i = 0; i < count; i++){

    const div =
      document.createElement('div');

    div.className = 'card';

    div.style.marginTop = '10px';


    div.innerHTML = `

      <h4>
        👶 Enfant ${i + 1}
      </h4>


      <div class="form-grid">

        <div>

          <label>Prénom</label>

          <input
            class="input child-first-name"
            type="text">

        </div>


        <div>

          <label>Nom</label>

          <input
            class="input child-last-name"
            type="text">

        </div>


        <div>

          <label>Fille / Garçon</label>

          <select
            class="select child-gender">

            <option value="">
              -- Choisir --
            </option>

            <option value="fille">
              👧 Fille
            </option>

            <option value="garcon">
              👦 Garçon
            </option>

          </select>

        </div>


        <div>

          <label>Date de naissance</label>

          <input
            class="input child-birth-date"
            type="date">

        </div>

      </div>

    `;


    container.appendChild(div);

  }

}


/* =====================================================
   ENREGISTREMENT DU MEMBRE
   ===================================================== */

async function saveMember(){

  try{

    const firstName =
      $('memberFirstName')?.value.trim() || '';

    const lastName =
      $('memberLastName')?.value.trim() || '';

    const code =
      $('memberCode')?.value.trim() || '';

    const role =
      $('memberRole')?.value || 'user';


    /* -------------------------
       Vérifications
       ------------------------- */

    if(!firstName){

      alert(
        'Veuillez saisir le prénom.'
      );

      return;

    }


    if(!lastName){

      alert(
        'Veuillez saisir le nom.'
      );

      return;

    }


    if(!code){

      alert(
        'Veuillez saisir un code d’accès.'
      );

      return;

    }


    /* -------------------------
       Récupération des données
       ------------------------- */

    const birthDate =
      $('memberBirthDate')?.value || null;

    const gender =
      $('memberGender')?.value || null;

    const spEntryDate =
      $('memberSpEntryDate')?.value || null;

    const status =
      $('memberStatus')?.value || 'actif';

    const wasJsp =
      $('memberWasJsp')?.value === 'true';

    const bureauMember =
      $('memberBureau')?.value === 'true';

    const childrenCount =
      Number(
        $('memberChildrenCount')?.value || 0
      );


    /* -------------------------
       Création du compte
       ------------------------- */

    const {
      data,
      error
    } = await db.rpc(
      'create_member',
      {
        p_code: code,
        p_email: '',
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: '',
        p_role: role
      }
    );


    if(error){

      console.error(
        'ERREUR CREATE MEMBER :',
        error
      );

      alert(
        error.message ||
        'Impossible de créer le membre.'
      );

      return;

    }


    if(!data?.success){

      alert(
        data?.message ||
        'Impossible de créer le membre.'
      );

      return;

    }


    /*
      On récupère l'identifiant créé.
      Selon la réponse de la fonction SQL,
      il peut être présent sous différentes formes.
    */

    let memberId =
      data.member_id ||
      data.id ||
      data.member?.id;


    /*
      Si l'ID n'est pas renvoyé directement,
      on recherche le membre créé.
    */

    if(!memberId){

      const {
        data:createdMember,
        error:findError
      } = await db
        .from('members')
        .select('id')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .order(
          'created_at',
          {ascending:false}
        )
        .limit(1)
        .maybeSingle();


      if(findError){

        throw findError;

      }


      memberId =
        createdMember?.id;

    }


    if(!memberId){

      throw new Error(
        'Le membre a été créé mais son identifiant n’a pas pu être retrouvé.'
      );

    }


    /* -------------------------
       Informations complémentaires
       ------------------------- */

    const {
      error:memberUpdateError
    } = await db
      .from('members')
      .update({

        birth_date: birthDate,

        gender: gender,

        sp_entry_date: spEntryDate,

        status: status,

        was_jsp: wasJsp,

        bureau_member: bureauMember,

        children_count: childrenCount

      })
      .eq('id', memberId);


    if(memberUpdateError){

      throw memberUpdateError;

    }


    /* -------------------------
       ENFANTS
       ------------------------- */

    const children = [
      ...document.querySelectorAll(
        '#childrenContainer .card'
      )
    ];


    for(const child of children){

      const first =
        child
          .querySelector('.child-first-name')
          ?.value.trim() || '';

      const last =
        child
          .querySelector('.child-last-name')
          ?.value.trim() || '';

      const childGender =
        child
          .querySelector('.child-gender')
          ?.value || null;

      const childBirthDate =
        child
          .querySelector('.child-birth-date')
          ?.value || null;


      /*
        On n'enregistre que les enfants
        pour lesquels un prénom est renseigné.
      */

      if(!first){

        continue;

      }


      const {
        error:childError
      } = await db
        .from('member_children')
        .insert({

          member_id: memberId,

          first_name: first,

          last_name: last || null,

          gender: childGender,

          birth_date: childBirthDate

        });


      if(childError){

        throw childError;

      }

    }


    /* -------------------------
       PÉRIODES D'INACTIVITÉ
       ------------------------- */

    const inactivityBlocks = [
      ...document.querySelectorAll(
        '#inactivityContainer .card'
      )
    ];


    for(const block of inactivityBlocks){

      const start =
        block
          .querySelector('.inactivity-start')
          ?.value || '';

      const end =
        block
          .querySelector('.inactivity-end')
          ?.value || null;


      if(!start){

        continue;

      }


      if(
        end &&
        end < start
      ){

        alert(
          'Une date de fin d’inactivité est antérieure à sa date de début.'
        );

        return;

      }


      const {
        error:inactivityError
      } = await db
        .from('member_inactivity')
        .insert({

          member_id: memberId,

          start_date: start,

          end_date: end

        });


      if(inactivityError){

        throw inactivityError;

      }

    }


    /* -------------------------
       FIN
       ------------------------- */

    closeModal();


    alert(
      '✅ Membre créé avec toutes ses informations.'
    );


    await renderAdmin();


  }catch(error){

    console.error(
      'ERREUR CREATION MEMBRE :',
      error
    );


    alert(
      error.message ||
      'Une erreur est survenue lors de la création du membre.'
    );

  }

}

async function changeCode(id){

  const code = prompt('Nouveau code d’accès :');

  if(code === null){
    return;
  }

  const newCode = code.trim();

  if(!newCode){
    alert('Le code ne peut pas être vide.');
    return;
  }

  try{

    const { data, error } = await db.rpc(
      'set_member_code',
      {
        p_code: newCode,
        p_member_id: id
      }
    );

    console.log('RESULTAT SET MEMBER CODE :', data);
    console.log('ERREUR SET MEMBER CODE :', error);

    if(error){
      throw error;
    }

    alert('✅ Code modifié.');

    await renderAdmin();

  }catch(error){

    console.error(
      'ERREUR MODIFICATION CODE ADMIN :',
      error
    );

    alert(
      error.message ||
      'Impossible de modifier le code.'
    );

  }

}
async function toggleMember(id,active){
  try{
    const {error}=await db.from('members').update({active}).eq('id',id);
    if(error)throw error;
/* =====================================================
   📜 HISTORIQUE — ACTIVATION / DÉSACTIVATION MEMBRE
===================================================== */

if(typeof addSystemHistory === 'function'){

  await addSystemHistory(
    'members',
    active
      ? 'Activation d’un membre'
      : 'Désactivation d’un membre',
    active
      ? `Le membre ${id} a été activé.`
      : `Le membre ${id} a été désactivé.`,
    'success',
    {
      member_id: id,
      active: active
    }
  );

}
    
    await renderAdmin();
  }catch(error){alert(error.message||'Impossible de modifier le membre.');}
}


/* =========================================================
   LISTINGS ADMIN
   ========================================================= */

async function showListingsAdmin(){

  if(!member || String(member.role).toLowerCase() !== 'admin'){
    alert('Accès administrateur requis.');
    return;
  }

  try{

    const {data:listings,error} = await db
      .from('listings')
      .select('id,name,created_at')
      .order('created_at',{ascending:false});

    if(error) throw error;

    let html = `
      <h2>📋 Listings</h2>

      <p class="muted">
        Créez des tableaux personnalisés pour recueillir des informations auprès des membres.
      </p>

      <div class="row" style="margin-top:15px;">
        <button
          type="button"
          class="primary"
          onclick="newListing()">
          ➕ Nouveau listing
        </button>
      </div>

      <div style="margin-top:20px;">
    `;

    if(!listings || !listings.length){

      html += `
        <div class="card">
          <p>📭 Aucun listing créé pour le moment.</p>
        </div>
      `;

    }else{

      for(const listing of listings){

        html += `
          <div class="card"
               style="margin-bottom:12px;">

            <div class="section-title">

              <div>
                <h3>
                  📋 ${esc(listing.name)}
                </h3>

                <p class="muted">
                  Créé le ${fmtDate(listing.created_at)}
                </p>
              </div>

              <div class="row" style="gap:6px;">

                <button
                  type="button"
                  class="primary"
                  onclick="openListing('${listing.id}')">
                  📊 Ouvrir
                </button>

                <button
                  type="button"
                  class="ghost"
                  onclick="editListing('${listing.id}')">
                  ✏️ Modifier
                </button>

                <button
                  type="button"
                  class="ghost"
                  style="color:#b00000;"
                  onclick="deleteListing('${listing.id}')">
                  🗑️ Supprimer
                </button>

              </div>

            </div>

          </div>
        `;
      }
    }

    html += `
      </div>

      <div class="row"
           style="margin-top:18px;justify-content:flex-end;">

        <button
          type="button"
          class="ghost"
          onclick="closeModal()">
          Fermer
        </button>

      </div>
    `;

    openModal(html);

  }catch(error){

    console.error('ERREUR LISTINGS :',error);

    alert(
      error.message ||
      'Impossible de charger les listings.'
    );
  }
}


/* =========================================================
   CREATION D'UN LISTING
   ========================================================= */

function newListing(){

  openModal(`

    <h2>➕ Nouveau listing</h2>

    <div class="field">

      <label>Nom du listing</label>

      <input
        id="listingName"
        class="input"
        type="text"
        placeholder="Ex : Repas Sainte-Barbe">

    </div>


    <div
      class="card"
      style="margin-top:15px;"
    >

      <h3>👥 Catégories à inclure</h3>

      <p class="muted">
        Sélectionnez une ou plusieurs catégories.
      </p>


      <label class="check">

        <input
          id="listingCategoryActifs"
          type="checkbox"
          checked
        >

        🚒 Actifs

      </label>


      <label class="check">

        <input
          id="listingCategoryRetraites"
          type="checkbox"
        >

        🧓 Retraités

      </label>


      <label class="check">

        <input
          id="listingCategoryEnfants"
          type="checkbox"
        >

        👶 Enfants
        <span class="muted">
          (jusqu'à l'année des 16 ans incluse)
        </span>

      </label>


      <label class="check">

        <input
          id="listingCategoryBureau"
          type="checkbox"
        >

        🏠 Membres du bureau

      </label>

    </div>


    <div
      id="listingOptionsContainer"
      style="margin-top:15px;"
    >

      <label>

        <strong>Options</strong>

      </label>


      <div
        id="listingOptions"
        style="margin-top:8px;"
      >

        <div
          class="row listing-option-row"
          style="gap:8px;margin-bottom:8px;"
        >

          <input
            class="input listing-option-input"
            placeholder="Ex : Présent"
          >

          <button
            type="button"
            class="ghost"
            onclick="this.parentElement.remove()"
          >

            🗑️

          </button>

        </div>


        <div
          class="row listing-option-row"
          style="gap:8px;margin-bottom:8px;"
        >

          <input
            class="input listing-option-input"
            placeholder="Ex : Absent"
          >

          <button
            type="button"
            class="ghost"
            onclick="this.parentElement.remove()"
          >

            🗑️

          </button>

        </div>

      </div>


      <button
        type="button"
        class="ghost"
        onclick="addListingOption()"
      >

        ➕ Ajouter une option

      </button>

    </div>


    <div
      class="row"
      style="margin-top:20px;gap:8px;"
    >

      <button
        type="button"
        class="primary"
        onclick="saveNewListing()"
      >

        💾 Créer le listing

      </button>


      <button
        type="button"
        class="ghost"
        onclick="closeModal()"
      >

        Annuler

      </button>

    </div>

  `);
}

/* =========================================================
   AJOUT OPTION
   ========================================================= */

function addListingOption(){

  const container = $('listingOptions');

  if(!container) return;

  const div = document.createElement('div');

  div.className = 'row listing-option-row';

  div.style =
    'gap:8px;margin-bottom:8px;';

  div.innerHTML = `

    <input
      class="input listing-option-input"
      placeholder="Nouvelle option">

    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove()">
      🗑️
    </button>

  `;

  container.appendChild(div);
}


/* =========================================================
   ENREGISTREMENT NOUVEAU LISTING
   ========================================================= */

async function saveNewListing(){

  try{

    if(
      !member ||
      String(member.role).toLowerCase() !== 'admin'
    ){

      alert('Accès administrateur requis.');

      return;

    }


    const name =
      $('listingName')?.value.trim() || '';


    if(!name){

      alert(
        'Veuillez donner un nom au listing.'
      );

      return;

    }


    /* =========================
       CATÉGORIES
       ========================= */

    const categories = [];


    if(
      $('listingCategoryActifs')?.checked
    ){

      categories.push('actifs');

    }


    if(
      $('listingCategoryRetraites')?.checked
    ){

      categories.push('retraites');

    }


    if(
      $('listingCategoryEnfants')?.checked
    ){

      categories.push('enfants');

    }


    if(
      $('listingCategoryBureau')?.checked
    ){

      categories.push('bureau');

    }


    if(!categories.length){

      alert(
        'Sélectionnez au moins une catégorie.'
      );

      return;

    }


    /* =========================
       OPTIONS
       ========================= */

    const options = [
      ...document.querySelectorAll(
        '.listing-option-input'
      )
    ]
      .map(input => input.value.trim())
      .filter(Boolean);


    if(!options.length){

      alert(
        'Ajoutez au moins une option.'
      );

      return;

    }


    const normalized =
      options.map(
        x => x.toLowerCase()
      );


    if(
      new Set(normalized).size !==
      normalized.length
    ){

      alert(
        'Deux options identiques ne sont pas autorisées.'
      );

      return;

    }


    /* =========================
       SESSION
       ========================= */

    const {
      data:{
        session
      }
    } =
      await db.auth.getSession();


    if(!session?.user?.id){

      throw new Error(
        'Session Supabase inexistante.'
      );

    }


    /* =========================
       CRÉATION LISTING
       ========================= */

    const {
      data:listing,
      error:listingError
    } =
      await db
        .from('listings')
        .insert({

          name:name,

          created_by:
            session.user.id,

          categories:
            categories

        })
        .select('id')
        .single();


    if(listingError){

      throw listingError;

    }


    /* =========================
       OPTIONS
       ========================= */

    const optionRows =
      options.map(
        (option,index) => ({

          listing_id:
            listing.id,

          name:
            option,

          position:
            index + 1

        })
      );


    const {
      error:optionsError
    } =
      await db
        .from('listing_options')
        .insert(optionRows);


    if(optionsError){

      throw optionsError;

    }


    closeModal();


    alert(
      '✅ Listing créé avec succès.'
    );


    showListingsAdmin();


  }catch(error){

    console.error(
      'ERREUR CREATION LISTING :',
      error
    );


    alert(
      error.message ||
      'Impossible de créer le listing.'
    );

  }

}
/* =========================================================
   OUVRIR UN LISTING
   ========================================================= */

async function openListing(listingId){

  console.log('📋 OUVERTURE LISTING - ID REÇU :', listingId);

  try{

    if(!member || String(member.role).toLowerCase() !== 'admin'){
      alert('Accès administrateur requis.');
      return;
    }


    /* =========================
       LISTING
       ========================= */

    const {
      data:listing,
      error:listingError
    } = await db
      .from('listings')
      .select('id,name,categories,created_at')
      .eq('id',listingId)
      .single();

    if(listingError) throw listingError;


    /* =========================
       OPTIONS
       ========================= */

    const {
      data:options,
      error:optionsError
    } = await db
      .from('listing_options')
      .select('id,name,position')
      .eq('listing_id',listingId)
      .order('position',{ascending:true});

    if(optionsError) throw optionsError;


    /* =========================
       CATÉGORIES
       ========================= */

    const categories =
      Array.isArray(listing.categories)
        ? listing.categories
        : [];


    /*
      Si ancien listing créé avant
      l'ajout des catégories :
      on garde le comportement historique
      = membres actifs.
    */

    const useOldBehaviour =
      categories.length === 0;


    /* =========================
       ANNÉE DU LISTING
       ========================= */

    const listingDate =
      listing.created_at
        ? new Date(listing.created_at)
        : new Date();

    const listingYear =
      listingDate.getFullYear();


    /*
      Pour les enfants :
      moins de 16 ans au 1er janvier
      de l'année du listing.
    */

    const januaryFirst =
      new Date(listingYear,0,1);


    /* =========================
       MEMBRES
       ========================= */

    const {
      data:allMembers,
      error:membersError
    } = await db
      .from('members')
      .select(`
        id,
        first_name,
        last_name,
        role,
        active,
        status,
        bureau_member
      `)
      .neq('role','admin')
      .order('last_name',{ascending:true});

    if(membersError) throw membersError;


    /* =========================
       ENFANTS
       ========================= */

    let children = [];


    if(
      useOldBehaviour ||
      categories.includes('enfants')
    ){

      const {
        data:childrenData,
        error:childrenError
      } = await db
        .from('member_children')
        .select(`
          id,
          member_id,
          first_name,
          last_name,
          gender,
          birth_date
        `)
        .order('last_name',{ascending:true});

      if(childrenError) throw childrenError;


  children =
  (childrenData || [])
    .filter(child => {

      if(!child.birth_date)
        return false;


      const birth =
        new Date(child.birth_date);


      /*
        Âge au 1er janvier de l'année
        du listing pour déterminer
        s'il a moins de 16 ans.
      */

const age =
  listingYear - birth.getFullYear();

return age >= 0 && age <= 16;

    })
    .sort((a,b) => {

      /*
        Plus la date de naissance est récente,
        plus l'enfant est jeune.

        Donc :
        2022 avant 2020
        → plus jeune en premier.
      */

      return new Date(b.birth_date) -
             new Date(a.birth_date);

    });

    }


    /* =========================
       CONSTRUCTION DES PARTICIPANTS
       ========================= */

    const participants = [];


    /*
      Utilisé pour éviter les doublons.
    */

    const memberIds = new Set();


    for(const m of allMembers || []){

      let include = false;


      if(useOldBehaviour){

        include =
          m.active === true;

      }else{

        const isActif =
          (
            m.active === true &&
            String(m.status || '').toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g,'')
              === 'actif'
          );


        const isRetraite =
          String(m.status || '').toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .includes('retrait');


        const isAmicale =
          m.bureau_member === true;


        if(
          categories.includes('actifs') &&
          isActif
        ){

          include = true;

        }


        if(
          categories.includes('retraites') &&
          isRetraite
        ){

          include = true;

        }


        if(
          categories.includes('bureau') &&
          isAmicale
        ){

          include = true;

        }

      }


      /*
        Une personne appartenant à plusieurs
        catégories n'apparaît qu'une seule fois.
      */

      if(include){

        if(!memberIds.has(String(m.id))){

          memberIds.add(String(m.id));


          participants.push({

            type:'member',

            id:m.id,

            member_id:m.id,

            child_id:null,

            first_name:m.first_name,

            last_name:m.last_name

          });

        }

      }

    }


 /* =========================
   ENFANTS
   ========================= */

if(
  useOldBehaviour ||
  categories.includes('enfants')
){

  for(const child of children){

    const birth =
      new Date(child.birth_date);

    /*
      Calcul de l'âge exact au moment
      de la création du listing.
    */

    let ageYears =
      listingDate.getFullYear() -
      birth.getFullYear();

    let ageMonths =
      listingDate.getMonth() -
      birth.getMonth();

    if(
      listingDate.getDate() <
      birth.getDate()
    ){

      ageMonths--;

    }

    if(ageMonths < 0){

      ageYears--;

      ageMonths += 12;

    }

    ageYears =
      Math.max(0, ageYears);

    ageMonths =
      Math.max(0, ageMonths);


    participants.push({

      type:'child',

      id:child.id,

      member_id:null,

      child_id:child.id,

      first_name:child.first_name,

      last_name:child.last_name,

      gender:child.gender,

      birth_date:child.birth_date,

      age_years:ageYears,

      age_months:ageMonths

    });

  }


  /*
    Classement des enfants
    du plus âgé au plus jeune.
  */

  participants.sort((a,b)=>{

    if(a.type !== 'child' || b.type !== 'child'){
      return 0;
    }

    const ageA =
      (a.age_years * 12) +
      a.age_months;

    const ageB =
      (b.age_years * 12) +
      b.age_months;

    return ageB - ageA;

  });

}
    /* =========================
       CHOIX DÉJÀ ENREGISTRÉS
       ========================= */

    const {
      data:choices,
      error:choicesError
    } = await db
      .from('listing_choices')
      .select(`
        member_id,
        child_id,
        option_id,
        participant_type
      `)
      .eq('listing_id',listingId);

    if(choicesError) throw choicesError;


    const choiceSet = new Set();


    for(const c of choices || []){

      const participantId =
        c.participant_type === 'child'
          ? `child_${c.child_id}`
          : `member_${c.member_id}`;


      choiceSet.add(
        `${participantId}_${c.option_id}`
      );

    }


    /* =========================
       AFFICHAGE
       ========================= */

    let html = `

      <h2>
        📋 ${esc(listing.name)}
      </h2>


      <p class="muted">

        ${participants.length}
        participant${participants.length > 1 ? 's' : ''}

        ${!useOldBehaviour
          ? ` · Listing ${listingYear}`
          : ''
        }

      </p>


      ${
        !useOldBehaviour
          ? `
            <div
              class="card"
              style="margin:12px 0;"
            >

              <strong>Catégories :</strong>

              ${categories.includes('actifs')
                ? ' 🚒 Actifs'
                : ''
              }

              ${categories.includes('retraites')
                ? ' 🧓 Retraités'
                : ''
              }

              ${categories.includes('enfants')
                ? ' 👶 Enfants (-16 ans)'
                : ''
              }

              ${categories.includes('amicale')
                ? ' 🏠 Membres de l’Amicale'
                : ''
              }

            </div>
          `
          : ''
      }


      <div
        class="table-wrap"
        style="margin-top:15px;"
      >

        <table class="table">

          <thead>

            <tr>

              <th>
                Participant
              </th>

              ${(options || []).map(option => `

                <th style="text-align:center;">

                  ${esc(option.name)}

                </th>

              `).join('')}

            </tr>

          </thead>


          <tbody>

            ${(participants || []).map(p => {

              const nom =
                `${p.first_name || ''} ${p.last_name || ''}`
                  .trim() ||
                'Sans nom';


              const label =
                p.type === 'child'
                  ? `👶 ${nom}`
                  : `👤 ${nom}`;


              const ageLabel =
  p.type === 'child'
    ? `${p.age_years} an${p.age_years > 1 ? 's' : ''} ${p.age_months} mois`
    : '';

              const participantId =
                p.type === 'child'
                  ? `child_${p.child_id}`
                  : `member_${p.member_id}`;


              return `

                <tr>

                  <td>

              <strong>
  ${esc(label)}
</strong>

${
  p.type === 'child'
    ? `
      <div
        style="
          margin-top:4px;
          font-size:12px;
          opacity:.65;
        "
      >
        🎂 ${esc(ageLabel)}
      </div>
    `
    : ''
}

                  </td>


                  ${(options || []).map(option => {

                    const checked =
                      choiceSet.has(
                        `${participantId}_${option.id}`
                      );


                    return `

                      <td
                        style="text-align:center;"
                      >

                        <input

                          type="checkbox"

                          class="listing-choice"

                          data-participant-type="${p.type}"

                          data-member-id="${p.member_id || ''}"

                          data-child-id="${p.child_id || ''}"

                          data-option-id="${option.id}"

                          ${checked ? 'checked' : ''}

                        >

                      </td>

                    `;

                  }).join('')}

                </tr>

              `;

            }).join('')}

          </tbody>

        </table>

      </div>


      <div
        class="row"
        style="
          margin-top:18px;
          gap:8px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="saveListingChoices('${listingId}')"
        >

          💾 Enregistrer

        </button>


        <button
          type="button"
          class="ghost"
          onclick="showListingRecap('${listingId}')"
        >

          📊 Récapitulatif

        </button>


<button
  type="button"
  class="ghost"
  onclick="printCurrentModal()">

  🖨️ Imprimer

</button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR OUVERTURE LISTING :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger le listing.'
    );

  }

}

/* =========================================================
   SAUVEGARDE DES CASES
   ========================================================= */

async function saveListingChoices(listingId){

  try{

    const checked = [
      ...document.querySelectorAll(
        '.listing-choice:checked'
      )
    ];

    /*
      On supprime les anciens choix du listing
    */

    const {error:deleteError} = await db
      .from('listing_choices')
      .delete()
      .eq('listing_id',listingId);

    if(deleteError) throw deleteError;


    /*
      Aucun choix
    */

    if(!checked.length){

      alert('✅ Les choix ont été enregistrés.');

      return;

    }


    /*
      Construction des lignes

      MEMBRE :
        member_id = UUID du membre
        child_id  = null
        participant_type = member

      ENFANT :
        member_id = null
        child_id  = UUID de l'enfant
        participant_type = child
    */

    const rows = checked.map(input => {

      const memberId =
        input.dataset.memberId || null;

      const childId =
        input.dataset.childId || null;


      const participantType =
        input.dataset.participantType ||
        (childId ? 'child' : 'member');


      return {

        listing_id: listingId,

        option_id:
          input.dataset.optionId,

        member_id:
          participantType === 'child'
            ? null
            : memberId,

        child_id:
          participantType === 'child'
            ? childId
            : null,

        participant_type:
          participantType

      };

    });


    console.log(
      'LISTING CHOICES À ENREGISTRER :',
      rows
    );


    /*
      Vérification sécurité :
      on ne tente pas d'envoyer un UUID vide.
    */

    const invalidRow = rows.find(row => {

      if(!row.option_id){

        return true;

      }

      if(row.participant_type === 'child'){

        return !row.child_id;

      }

      return !row.member_id;

    });


    if(invalidRow){

      console.error(
        'LIGNE LISTING INVALIDE :',
        invalidRow
      );

      throw new Error(
        'Impossible d’identifier correctement le participant sélectionné.'
      );

    }


    const {error:insertError} = await db
      .from('listing_choices')
      .insert(rows);

    if(insertError) throw insertError;


    alert(
      '✅ Les choix ont été enregistrés.'
    );


  }catch(error){

    console.error(
      'ERREUR SAUVEGARDE LISTING :',
      error
    );

    alert(
      error.message ||
      'Impossible d’enregistrer les choix.'
    );

  }

}


/* =========================================================
   RECAPITULATIF
   ========================================================= */

async function showListingRecap(listingId){

  try{

    const {data:listing,error:listingError} = await db
      .from('listings')
      .select('id,name')
      .eq('id',listingId)
      .single();

    if(listingError) throw listingError;

    const {data:options,error:optionsError} = await db
      .from('listing_options')
      .select('id,name,position')
      .eq('listing_id',listingId)
      .order('position',{ascending:true});

    if(optionsError) throw optionsError;

    const {data:members,error:membersError} = await db
      .from('members')
      .select('id')
      .eq('active',true)
      .neq('role','admin');

    if(membersError) throw membersError;

    const {data:choices,error:choicesError} = await db
      .from('listing_choices')
      .select('option_id')
      .eq('listing_id',listingId);

    if(choicesError) throw choicesError;

    const total = members?.length || 0;

    let html = `

      <h2>
        📊 ${esc(listing.name)}
      </h2>

      <p>
        Total des utilisateurs :
        <strong>${total}</strong>
      </p>

      <div
        class="grid"
        style="margin-top:15px;">

    `;

    for(const option of (options || [])){

      const count =
        (choices || [])
          .filter(
            choice =>
              String(choice.option_id) ===
              String(option.id)
          )
          .length;

      const percentage =
        total > 0
          ? Math.round((count / total) * 100)
          : 0;

      html += `

        <div class="card">

          <h3>
            ${esc(option.name)}
          </h3>

          <div class="stat">
            ${count}/${total}
          </div>

          <p>
            ${percentage} %
          </p>

        </div>

      `;
    }

    html += `

      </div>

      <div
        class="row"
        style="
          margin-top:18px;
          justify-content:flex-end;
        ">

        <button
          type="button"
          class="ghost"
          onclick="openListing('${listingId}')">

          ← Retour au listing

        </button>

<button
  type="button"
  class="ghost"
  onclick="printCurrentModal()">

  🖨️ Imprimer le récapitulatif

</button>

      </div>

    `;

    openModal(html);

  }catch(error){

    console.error(
      'ERREUR RECAP LISTING :',
      error
    );

    alert(
      error.message ||
      'Impossible de calculer le récapitulatif.'
    );
  }
}


/* =========================================================
   MODIFICATION D'UN LISTING
   ========================================================= */

async function editListing(listingId){

  try{

    const {data:listing,error:listingError} = await db
      .from('listings')
      .select('id,name')
      .eq('id',listingId)
      .single();

    if(listingError) throw listingError;

    const {data:options,error:optionsError} = await db
      .from('listing_options')
      .select('id,name,position')
      .eq('listing_id',listingId)
      .order('position',{ascending:true});

    if(optionsError) throw optionsError;

    openModal(`

      <h2>✏️ Modifier le listing</h2>

      <div class="field">

        <label>Nom</label>

        <input
          id="editListingName"
          class="input"
          value="${esc(listing.name)}">

      </div>

      <div
        id="editListingOptions"
        style="margin-top:15px;">

        ${(options || []).map(option => `

          <div
            class="row edit-listing-option-row"
            data-option-id="${option.id}"
            style="
              gap:8px;
              margin-bottom:8px;
            ">

            <input
              class="input edit-listing-option-input"
              value="${esc(option.name)}">

            <button
              type="button"
              class="ghost"
              onclick="this.parentElement.remove()">

              🗑️

            </button>

          </div>

        `).join('')}

      </div>

      <button
        type="button"
        class="ghost"
        onclick="addEditListingOption()">

        ➕ Ajouter une option

      </button>

      <div
        class="row"
        style="margin-top:20px;gap:8px;">

        <button
          type="button"
          class="primary"
          onclick="saveEditListing('${listingId}')">

          💾 Enregistrer

        </button>

        <button
          type="button"
          class="ghost"
          onclick="closeModal()">

          Annuler

        </button>

      </div>

    `);

  }catch(error){

    console.error(error);

    alert(
      error.message ||
      'Impossible de modifier le listing.'
    );
  }
}


function addEditListingOption(){

  const container =
    $('editListingOptions');

  if(!container) return;

  const div =
    document.createElement('div');

  div.className =
    'row edit-listing-option-row';

  div.style =
    'gap:8px;margin-bottom:8px;';

  div.innerHTML = `

    <input
      class="input edit-listing-option-input"
      placeholder="Nouvelle option">

    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove()">

      🗑️

    </button>

  `;

  container.appendChild(div);
}


async function saveEditListing(listingId){

  try{

    const name =
      $('editListingName')?.value.trim() || '';

    if(!name){

      alert('Le nom du listing est obligatoire.');

      return;
    }

    const rows = [
      ...document.querySelectorAll(
        '.edit-listing-option-row'
      )
    ];

    const options = rows
      .map(row => ({

        id:row.dataset.optionId || null,

        name:
          row.querySelector(
            '.edit-listing-option-input'
          )?.value.trim() || ''

      }))
      .filter(option => option.name);

    if(!options.length){

      alert('Il faut au moins une option.');

      return;
    }

    const normalized =
      options.map(
        option => option.name.toLowerCase()
      );

    if(
      new Set(normalized).size !==
      normalized.length
    ){

      alert(
        'Deux options identiques ne sont pas autorisées.'
      );

      return;
    }

    /* Modification du nom */

    const {error:nameError} = await db
      .from('listings')
      .update({name})
      .eq('id',listingId);

    if(nameError) throw nameError;

    /*
      Pour les options :
      on recrée les options.
      Les choix existants doivent être supprimés
      car les anciens option_id ne correspondent
      plus forcément aux nouvelles options.
    */

    const {error:choiceDeleteError} = await db
      .from('listing_choices')
      .delete()
      .eq('listing_id',listingId);

    if(choiceDeleteError)
      throw choiceDeleteError;

    const {error:optionDeleteError} = await db
      .from('listing_options')
      .delete()
      .eq('listing_id',listingId);

    if(optionDeleteError)
      throw optionDeleteError;

    const optionRows =
      options.map((option,index)=>({

        listing_id:listingId,

        name:option.name,

        position:index + 1

      }));

    const {error:optionInsertError} = await db
      .from('listing_options')
      .insert(optionRows);

    if(optionInsertError)
      throw optionInsertError;

    closeModal();

    alert('✅ Listing modifié.');

    showListingsAdmin();

  }catch(error){

    console.error(
      'ERREUR MODIFICATION LISTING :',
      error
    );

    alert(
      error.message ||
      'Impossible de modifier le listing.'
    );
  }
}


/* =========================================================
   SUPPRESSION
   ========================================================= */

async function deleteListing(listingId){

  if(!confirm(
    'Voulez-vous vraiment supprimer ce listing ?\n\n' +
    'Toutes les cases cochées et les options seront supprimées.'
  )){
    return;
  }

  try{

    /*
      Suppression des choix
    */

    let result =
      await db
        .from('listing_choices')
        .delete()
        .eq('listing_id',listingId);

    if(result.error)
      throw result.error;

    /*
      Suppression des options
    */

    result =
      await db
        .from('listing_options')
        .delete()
        .eq('listing_id',listingId);

    if(result.error)
      throw result.error;

    /*
      Suppression du listing
    */

    result =
      await db
        .from('listings')
        .delete()
        .eq('id',listingId);

    if(result.error)
      throw result.error;

    alert('✅ Listing supprimé.');

    showListingsAdmin();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION LISTING :',
      error
    );

    alert(
      error.message ||
      'Impossible de supprimer le listing.'
    );
  }
}

// ============================================================
// 🏅 SUIVI DES MÉDAILLES
// ============================================================

// ============================================================
// 🏅 SUIVI DES MÉDAILLES
// ============================================================

async function medalTracking(){

  try{

    // ==========================================================
    // DATE DE RÉFÉRENCE
    // ==========================================================

    const year =
      new Date().getFullYear();

    const referenceDate =
      new Date(
        year,
        11,
        1
      );


    // ==========================================================
    // RÉCUPÉRATION DES MEMBRES ACTIFS
    // ==========================================================

    const {
      data:members,
      error:membersError
    } =
      await db
        .from('members')
        .select('*')
        .eq('active',true)
        .order(
          'last_name',
          {
            ascending:true
          }
        );


    if(membersError){

      throw membersError;

    }


    // ==========================================================
    // RÉCUPÉRATION DES PÉRIODES D'INACTIVITÉ
    // ==========================================================

    const {
      data:inactivities,
      error:inactivityError
    } =
      await db
        .from('member_inactivity')
        .select('*');


    if(inactivityError){

      throw inactivityError;

    }


    const inactivityList =
      inactivities || [];


    // ==========================================================
    // BARÈME FÉDÉRATION
    // ==========================================================

    const federation = [

      {
        months:120,
        name:'Bronze',
        emoji:'🥉'
      },

      {
        months:240,
        name:'Argent',
        emoji:'🥈'
      },

      {
        months:360,
        name:'Or',
        emoji:'🥇'
      }

    ];


    // ==========================================================
    // BARÈME UNION DÉPARTEMENTALE
    // ==========================================================

    const union = [

      {
        months:84,
        name:'Cuivre',
        emoji:'🟤'
      },

      {
        months:180,
        name:'Bronze',
        emoji:'🥉'
      },

      {
        months:240,
        name:'Argent',
        emoji:'🥈'
      },

      {
        months:360,
        name:'Or',
        emoji:'🥇'
      }

    ];


    // ==========================================================
    // ANCIENNETÉ RÉELLE EN MOIS
    // ==========================================================
    //
    // Ancienneté =
    // durée depuis l'entrée SP
    // - TOUTES les périodes d'inactivité.
    //
    // Aucun bonus JSP ici.
    //
    // ==========================================================

    function getSeniorityMonths(member){

      if(
        !member ||
        !member.sp_entry_date
      ){

        return 0;

      }


      const entry =
        new Date(
          member.sp_entry_date
        );


      if(
        isNaN(
          entry.getTime()
        )
      ){

        return 0;

      }


      // --------------------------------------------------------
      // Ancienneté brute
      // --------------------------------------------------------

      let months =

        (
          referenceDate.getFullYear() -
          entry.getFullYear()
        ) * 12

        +

        (
          referenceDate.getMonth() -
          entry.getMonth()
        );


      // Le jour anniversaire doit être atteint

      if(
        referenceDate.getDate() <
        entry.getDate()
      ){

        months--;

      }


      // --------------------------------------------------------
      // Retrait de TOUTES les périodes d'inactivité
      // --------------------------------------------------------

      inactivityList
        .filter(
          inactivity =>
            String(inactivity.member_id) ===
            String(member.id)
        )
        .forEach(
          inactivity => {

            if(
              !inactivity.start_date
            ){

              return;

            }


            let start =
              new Date(
                inactivity.start_date
              );


            if(
              isNaN(
                start.getTime()
              )
            ){

              return;

            }


            let end =
              inactivity.end_date
                ? new Date(
                    inactivity.end_date
                  )
                : new Date(
                    referenceDate
                  );


            if(
              isNaN(
                end.getTime()
              )
            ){

              end =
                new Date(
                  referenceDate
                );

            }


            // Une inactivité ne peut pas commencer
            // avant l'entrée SP

            if(
              start < entry
            ){

              start =
                new Date(
                  entry
                );

            }


            // Une période future ne compte pas

            if(
              start >= referenceDate
            ){

              return;

            }


            // Une période encore en cours
            // s'arrête à la référence

            if(
              end > referenceDate
            ){

              end =
                new Date(
                  referenceDate
                );

            }


            if(
              end <= start
            ){

              return;

            }


            // --------------------------------------------------
            // Durée de l'inactivité en mois complets
            // --------------------------------------------------

            let inactiveMonths =

              (
                end.getFullYear() -
                start.getFullYear()
              ) * 12

              +

              (
                end.getMonth() -
                start.getMonth()
              );


            if(
              end.getDate() <
              start.getDate()
            ){

              inactiveMonths--;

            }


            inactiveMonths =
              Math.max(
                0,
                inactiveMonths
              );


            // --------------------------------------------------
            // Retrait de cette période
            // --------------------------------------------------

            months -=
              inactiveMonths;

          }
        );


      return Math.max(
        0,
        months
      );

    }


    // ==========================================================
    // MÉDAILLES OBTENUES + PROCHAINE
    // ==========================================================

   function getMedals(
  member,
  months,
  medals
){

  // ==========================================================
  // ANCIENNETÉ UTILISÉE POUR LES MÉDAILLES
  // ==========================================================
  //
  // "months" = ancienneté réelle affichée
  //            après retrait de toutes les inactivités.
  //
  // L'ancien JSP bénéficie de 12 mois supplémentaires
  // UNIQUEMENT pour déterminer les médailles.
  //
  // L'ancienneté affichée ne change pas.
  //
  // ==========================================================

  let medalMonths =
    months;


  if(
    member &&
    member.was_jsp === true
  ){

    medalMonths += 12;

  }


  // ==========================================================
  // TRI DES MÉDAILLES
  // ==========================================================

  const sortedMedals =
    medals
      .slice()
      .sort(
        (a,b) =>
          a.months -
          b.months
      );


  // ==========================================================
  // MÉDAILLES DÉJÀ OBTENUES
  // ==========================================================

  const obtained =
    sortedMedals.filter(
      medal =>
        medalMonths >=
        medal.months
    );


  // ==========================================================
  // PROCHAINE MÉDAILLE
  // ==========================================================

  const next =
    sortedMedals.find(
      medal =>
        medalMonths <
        medal.months
    );


  return {

    obtained,

    next

  };

}

    function getMedalDate(
      member,
      medal
    ){

      if(
        !member ||
        !medal
      ){

        return null;

      }


      const seniority =
        getSeniorityMonths(
          member
        );


      let medalSeniority =
        seniority;


      // --------------------------------------------------------
      // Ancien JSP :
      // +12 mois uniquement pour les médailles
      // --------------------------------------------------------

      if(
        member.was_jsp === true
      ){

        medalSeniority +=
          12;

      }


      // --------------------------------------------------------
      // Date correspondant à l'ancienneté actuelle
      // --------------------------------------------------------

      const medalDate =
        new Date(
          referenceDate
        );


      // Nombre de mois d'ancienneté
      // dépassant le seuil de la médaille

      const monthsAfterMedal =
        medalSeniority -
        medal.months;


      medalDate.setMonth(
        medalDate.getMonth() -
        monthsAfterMedal
      );


      return medalDate;

    }


    // ==========================================================
    // MÉDAILLES OBTENUES CETTE ANNÉE
    // ==========================================================
    //
    // Période :
    //
    // 01/12/N-1 inclus
    // jusqu'au 01/12/N inclus
    //
    // ==========================================================

    function getMedalsThisYear(
      member,
      months,
      medals
    ){

      if(
        !member ||
        !Array.isArray(medals)
      ){

        return [];

      }


      let medalSeniority =
        months;


      // Ancien JSP :
      // +12 mois uniquement pour les médailles

      if(
        member.was_jsp === true
      ){

        medalSeniority +=
          12;

      }


      const periodStart =
        new Date(
          year - 1,
          11,
          1
        );


      const periodEnd =
        new Date(
          year,
          11,
          1
        );


      const result = [];


      medals.forEach(
        medal => {

          if(
            !medal ||
            typeof medal.months !==
            'number'
          ){

            return;

          }


          // La médaille n'est pas encore atteinte

          if(
            medalSeniority <
            medal.months
          ){

            return;

          }


          // ----------------------------------------------------
          // Date de la médaille calculée à partir
          // de l'ancienneté réelle
          // ----------------------------------------------------

          const medalDate =
            new Date(
              referenceDate
            );


          const monthsAfterMedal =
            medalSeniority -
            medal.months;


          medalDate.setMonth(
            medalDate.getMonth() -
            monthsAfterMedal
          );


          // ----------------------------------------------------
          // La médaille doit être dans la période annuelle
          // ----------------------------------------------------

          if(
            medalDate >= periodStart &&
            medalDate <= periodEnd
          ){

            result.push({

              ...medal,

              date:
                medalDate

            });

          }

        }
      );


      result.sort(
        (a,b) =>
          a.date.getTime() -
          b.date.getTime()
      );


      return result;

    }


    // ==========================================================
    // CONSTRUCTION DES DONNÉES
    // ==========================================================

    const rows =
      members.map(
        member => {

          const months =
            getSeniorityMonths(
              member
            );


const fed =
  getMedals(
    member,
    months,
    federation
  );


const ud =
  getMedals(
    member,
    months,
    union
  );


          const thisYearFed =
            getMedalsThisYear(
              member,
              months,
              federation
            );


          const thisYearUd =
            getMedalsThisYear(
              member,
              months,
              union
            );


          return {

            member,

            months,

            fed,

            ud,

            thisYearFed,

            thisYearUd

          };

        }
      );


    // ==========================================================
    // FORMAT ANCIENNETÉ
    // ==========================================================

    function formatSeniority(
      months
    ){

      const years =
        Math.floor(
          months / 12
        );


      const remaining =
        months % 12;


      if(
        !years
      ){

        return `${remaining} mois`;

      }


      if(
        !remaining
      ){

        return `${years} an${years > 1 ? 's' : ''}`;

      }


      return `${years} an${years > 1 ? 's' : ''} ${remaining} mois`;

    }


    // ==========================================================
    // FORMAT DATE
    // ==========================================================

    function formatDate(
      date
    ){

      if(
        !date ||
        isNaN(
          date.getTime()
        )
      ){

        return '—';

      }


      return date.toLocaleDateString(
        'fr-FR',
        {
          day:'2-digit',
          month:'2-digit',
          year:'numeric'
        }
      );

    }


    // ==========================================================
    // MÉDAILLES À REMETTRE CETTE ANNÉE
    // ==========================================================

    const toGive =
      rows.filter(
        r =>
          r.thisYearFed.length ||
          r.thisYearUd.length
      );


    const toGiveHtml =
      toGive.length

        ? toGive
            .map(
              r => {

                const m =
                  r.member;


                return `

                  <div class="card">

                    <h3>
                      🏅
                      ${esc(
                        `${
                          m.first_name || ''
                        } ${
                          m.last_name || ''
                        }`.trim()
                      )}
                    </h3>


                    ${
                      r.thisYearFed
                        .map(
                          x => `

                            <p>

                              🏅
                              <strong>
                                Fédération :
                              </strong>

                              ${x.emoji}
                              ${esc(x.name)}

                              — ${x.months / 12} ans

                              <br>

                              <small>
                                Date :
                                ${formatDate(x.date)}
                              </small>

                            </p>

                          `
                        )
                        .join('')
                    }


                    ${
                      r.thisYearUd
                        .map(
                          x => `

                            <p>

                              🏅
                              <strong>
                                Union départementale :
                              </strong>

                              ${x.emoji}
                              ${esc(x.name)}

                              —
                              ${
                                x.months === 90
                                  ? '7 ans 6 mois'
                                  : `${x.months / 12} ans`
                              }

                              <br>

                              <small>
                                Date :
                                ${formatDate(x.date)}
                              </small>

                            </p>

                          `
                        )
                        .join('')
                    }

                  </div>

                `;

              }
            )
            .join('')

        : `

            <p>
              ✅ Aucune médaille à remettre cette année.
            </p>

          `;


    // ==========================================================
    // TABLEAU COMPLET
    // ==========================================================

    const tableRows =
      rows
        .map(
          r => {

            const m =
              r.member;


            const name =
              `${
                m.first_name || ''
              } ${
                m.last_name || ''
              }`.trim();


            // --------------------------------------------------
            // Fédération déjà obtenue
            // --------------------------------------------------

            const fed =
              r.fed.obtained.length

                ? r.fed.obtained
                    .map(
                      x => {

                        const medalDate =
                          getMedalDate(
                            m,
                            x
                          );


                        return `

                          ${x.emoji}
                          ${esc(x.name)}

                          ${
                            medalDate

                              ? `

                                  <br>

                                  <small>
                                    📅 Obtenue en
                                    ${medalDate.getFullYear()}
                                  </small>

                                `

                              : ''
                          }

                        `;

                      }
                    )
                    .join('<br><br>')

                : '—';


            // --------------------------------------------------
            // Union déjà obtenue
            // --------------------------------------------------

            const ud =
              r.ud.obtained.length

                ? r.ud.obtained
                    .map(
                      x => {

                        const medalDate =
                          getMedalDate(
                            m,
                            x
                          );


                        return `

                          ${x.emoji}
                          ${esc(x.name)}

                          ${
                            medalDate

                              ? `

                                  <br>

                                  <small>
                                    📅 Obtenue en
                                    ${medalDate.getFullYear()}
                                  </small>

                                `

                              : ''
                          }

                        `;

                      }
                    )
                    .join('<br><br>')

                : '—';


            // --------------------------------------------------
            // Prochaine Fédération
            // --------------------------------------------------

            const nextFed =
              r.fed.next

                ? (() => {

                    const medalDate =
                      getMedalDate(
                        m,
                        r.fed.next
                      );


                    return `

                      ${r.fed.next.emoji}
                      ${esc(
                        r.fed.next.name
                      )}

                      ${
                        medalDate

                          ? `

                              <br>

                              <small>
                                📅 Obtention prévue en
                                ${medalDate.getFullYear()}
                              </small>

                            `

                          : ''
                      }

                    `;

                  })()

                : 'Toutes obtenues';


            // --------------------------------------------------
            // Prochaine Union
            // --------------------------------------------------

            const nextUd =
              r.ud.next

                ? (() => {

                    const medalDate =
                      getMedalDate(
                        m,
                        r.ud.next
                      );


                    return `

                      ${r.ud.next.emoji}
                      ${esc(
                        r.ud.next.name
                      )}

                      ${
                        medalDate

                          ? `

                              <br>

                              <small>
                                📅 Obtention prévue en
                                ${medalDate.getFullYear()}
                              </small>

                            `

                          : ''
                      }

                    `;

                  })()

                : 'Toutes obtenues';


            // --------------------------------------------------
            // Ligne
            // --------------------------------------------------

            return `

              <tr>

                <td>

                  <strong>
                    ${esc(name)}
                  </strong>

                </td>


                <td>

                  ${formatSeniority(r.months)}

                </td>


                <td>

                  ${fed}

                </td>


                <td>

                  ${ud}

                </td>


                <td>

                  ${nextFed}

                  <br>

                  ${nextUd}

                </td>

              </tr>

            `;

          }
        )
        .join('');


    // ==========================================================
    // POPUP ADMIN
    // ==========================================================

    openModal(`

      <h2>
        🏅 Suivi des médailles
      </h2>


      <p>

        📅 Date de référence :

        <strong>
          1er décembre ${year}
        </strong>

      </p>


      <hr>


      <h3>
        🏆 Médailles à remettre cette année
      </h3>


      ${toGiveHtml}


      <hr>


      <h3>
        📋 Suivi des membres actifs
      </h3>


      <div class="table-wrap">

        <table class="table">

          <thead>

            <tr>

              <th>
                Membre
              </th>

              <th>
                Ancienneté
              </th>

              <th>
                Fédération
              </th>

              <th>
                Union départementale
              </th>

              <th>
                Prochaine médaille
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              tableRows ||

              `

                <tr>

                  <td colspan="5">

                    Aucun membre actif.

                  </td>

                </tr>

              `
            }

          </tbody>

        </table>

      </div>


      <div
        class="row"
        style="margin-top:15px;"
      >

        <button
          type="button"
          class="ghost"
          onclick="printCurrentModal()"
        >

          🖨️ Imprimer

        </button>


        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR SUIVI MEDAILLES :',
      error
    );


    alert(
      error.message ||
      'Impossible de calculer le suivi des médailles.'
    );

  }

}
async function openMemberProfile(memberId){

  try{

    // --------------------------------------------------------
    // Récupération du membre
    // --------------------------------------------------------

    const { data: member, error } =
      await db
        .from('members')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();


    if(error){

      console.error(
        'Erreur chargement fiche membre :',
        error
      );

      alert(
        '❌ Impossible de charger la fiche du membre.'
      );

      return;

    }


    if(!member){

      alert(
        '❌ Membre introuvable.'
      );

      return;

    }


    // --------------------------------------------------------
    // 👶 Enfants
    // --------------------------------------------------------

    let children = [];

    try{

      const { data, error:childrenError } =
        await db
          .from('member_children')
          .select('*')
          .eq('member_id', memberId)
          .order('birth_date', {
            ascending:true
          });


      if(!childrenError){

        children = data || [];

      }

    }catch(error){

      console.warn(
        'Impossible de récupérer les enfants :',
        error
      );

    }


    // --------------------------------------------------------
    // ⏱️ Ancienneté
    // --------------------------------------------------------

    let seniorityText =
      'Non renseignée';


    if(member.join_date){

      const start =
        new Date(
          member.join_date + 'T00:00:00'
        );

      const now =
        new Date();


      let years =
        now.getFullYear() -
        start.getFullYear();

      let months =
        now.getMonth() -
        start.getMonth();


      if(
        now.getDate() <
        start.getDate()
      ){

        months--;

      }


      if(months < 0){

        years--;
        months += 12;

      }


      if(years < 0){

        years = 0;
        months = 0;

      }


      seniorityText =
        `${years} an${years > 1 ? 's' : ''}` +
        ` ${months} mois`;

    }


    // --------------------------------------------------------
    // 🟢 Statut
    // --------------------------------------------------------

    const status =
      member.status ||
      'Non renseigné';


    // --------------------------------------------------------
    // 👤 Nom
    // --------------------------------------------------------

    const fullName =
      `${member.first_name || ''} ${
        member.last_name || ''
      }`.trim();


    // --------------------------------------------------------
    // 📅 Date de naissance
    // --------------------------------------------------------

    const birthDate =
      member.birth_date
        ? new Date(
            member.birth_date +
            'T00:00:00'
          ).toLocaleDateString(
            'fr-FR'
          )
        : 'Non renseignée';


    // --------------------------------------------------------
    // 🚒 Date d'entrée
    // --------------------------------------------------------

    const joinDate =
      member.join_date
        ? new Date(
            member.join_date +
            'T00:00:00'
          ).toLocaleDateString(
            'fr-FR'
          )
        : 'Non renseignée';


    // --------------------------------------------------------
    // 🖨️ Contenu de la fiche
    // --------------------------------------------------------

    openModal(`

      <div
        id="memberProfilePrint"
      >

        <h2
          style="
            margin-top:0;
          "
        >
          👤 Fiche membre
        </h2>


        <div
          class="card"
          style="
            margin-top:15px;
            text-align:center;
          "
        >

          <h2
            style="
              margin:0;
            "
          >
            ${esc(fullName)}
          </h2>

          <p
            class="muted"
            style="
              margin:6px 0 0;
            "
          >
            ${esc(status)}
          </p>

        </div>


        <!-- INFORMATIONS -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            👤 Informations personnelles
          </h3>

          <p>
            📅 <strong>Date de naissance :</strong>
            ${birthDate}
          </p>

          <p>
            ⚧️ <strong>Sexe :</strong>
            ${esc(member.gender || 'Non renseigné')}
          </p>

        </div>


        <!-- ENGAGEMENT -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            🚒 Engagement
          </h3>

          <p>
            📅 <strong>Entrée chez les SP :</strong>
            ${joinDate}
          </p>

          <p>
            ⏱️ <strong>Ancienneté :</strong>
            ${seniorityText}
          </p>

          ${
            member.was_jsp === true
              ? `
                <p>
                  👨‍🚒 <strong>Ancien JSP :</strong>
                  Oui
                </p>
              `
              : ''
          }

        </div>


        <!-- FAMILLE -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            👨‍👩‍👧 Famille
          </h3>

          <p>

            👶
            <strong>
              ${children.length}
            </strong>

            enfant${children.length > 1 ? 's' : ''}

          </p>

          ${
            children.length

              ? `

                <div
                  style="
                    margin-top:10px;
                  "
                >

                  ${children.map(child => `

                    <div
                      style="
                        padding:8px 0;
                        border-top:
                          1px solid #e5e7eb;
                      "
                    >

                      👶
                      ${esc(
                        child.first_name ||
                        'Enfant'
                      )}

                    </div>

                  `).join('')}

                </div>

              `

              : ''
          }

        </div>

      </div>


      <!-- BOUTONS -->

      <div
        class="row"
        style="
          margin-top:20px;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="
            printMemberProfile(
              '${member.id}'
            )
          "
        >
          🖨️ Imprimer
        </button>


        <button
          type="button"
          class="secondary"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'Erreur fiche membre :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


window.openMemberProfile =
  openMemberProfile;

function printMemberProfile(memberId){

  const content =
    document.getElementById('memberProfilePrint');

  if(!content){

    alert(
      '❌ Impossible de récupérer la fiche membre.'
    );

    return;

  }

  const printWindow =
    window.open(
      '',
      '_blank',
      'width=900,height=700'
    );

  if(!printWindow){

    alert(
      "❌ La fenêtre d'impression a été bloquée par le navigateur."
    );

    return;

  }

  printWindow.document.open();

  printWindow.document.write(`

    <!DOCTYPE html>

    <html lang="fr">

    <head>

      <meta charset="UTF-8">

      <title>Fiche membre</title>

      <style>

        *{
          box-sizing:border-box;
        }

        body{
          font-family:Arial,sans-serif;
          margin:0;
          padding:30px;
          color:#111;
          background:white;
        }

        h2{
          margin-top:0;
        }

        h3{
          margin-bottom:10px;
        }

        p{
          margin:8px 0;
        }

        .card{
          border:1px solid #ddd;
          border-radius:10px;
          padding:15px;
          margin-bottom:12px;
          background:#fff;
        }

        .muted{
          color:#666;
        }

        @media print{

          body{
            padding:0;
          }

          .card{
            break-inside:avoid;
          }

        }

      </style>

    </head>

    <body>

      ${content.innerHTML}

    </body>

    </html>

  `);

  printWindow.document.close();

  printWindow.onload = function(){

    setTimeout(
      function(){

        printWindow.focus();

        printWindow.print();

      },
      300
    );

  };

}


window.printMemberProfile =
  printMemberProfile;


/* ============================================================
   🚒 ADMINISTRATION - NOUVELLE INTERFACE
   ============================================================ */


/* ============================================================
   VARIABLES ADMIN TEMPORAIRES
   Permettent aux différentes fonctions du menu d'utiliser
   les données déjà chargées par renderAdmin().
   ============================================================ */

let adminDashboardData = {
  events: [],
  polls: [],
  members: [],
  listings: [],
  ideas: [],
  requests: [],
  materials: [],
  children: [],
  eventResponses: [],
  pollResponses: [],
  adminNotes: [],
  adminNoteReads: [],
  pendingMeetingSubjects: 0,
  activeMembers: 0,
  retiredMembers: 0,
  bureauMembers: 0,
  childrenUnder16: 0,
  currentLoans: 0,
  pendingRequests: 0,
  newIdeas: 0,
  adminUnreadMessages: 0,
  maintenanceActive: false,
  totalPeople: 0
};


/* ============================================================
   RENDER ADMIN
   ============================================================ */

async function renderAdmin(){

  $('homeUser')?.classList.add('hidden');
  $('homeAdmin')?.classList.remove('hidden');

  try{

    /* ========================================================
       MAINTENANCE
       ======================================================== */

    const maintenanceRes = await db
      .from('system_settings')
      .select('maintenance_mode')
      .eq('id','global')
      .single();

    if(maintenanceRes.error){
      throw maintenanceRes.error;
    }

    const maintenanceActive =
      maintenanceRes.data?.maintenance_mode === true;


    /* ========================================================
       DONNÉES
       ======================================================== */

    const eventsRes = await db
      .from('events')
      .select('*')
      .order('event_date',{ascending:false});


    const pollsRes = await db
      .from('polls')
      .select('*')
      .order('created_at',{ascending:false});


    const membersRes = await db
      .from('members')
      .select('*')
      .eq('role','user')
      .order('last_name',{ascending:true});


    const listingsRes = await db
      .from('listings')
      .select('id,name,created_at')
      .order('created_at',{ascending:false});


    const ideasRes = await db
      .from('ideas')
      .select(
        'id,member_id,content,status,admin_note,created_at,updated_at'
      )
      .order('created_at',{ascending:false});


    const reqsRes = await db
      .from('material_requests')
      .select(`
        id,
        member_id,
        start_date,
        return_date,
        status,
        reason,
        comment,
        created_at,
        members(first_name,last_name)
      `)
      .order('created_at',{ascending:false});


    const reqItemsRes = await db
      .from('material_request_items')
      .select('request_id,material_id,quantity');


    const materialsRes = await db
      .from('materials')
      .select(
        'id,name,description,quantity,available,loan_allowed'
      )
      .order('name',{ascending:true});


    const childrenRes = await db
      .from('member_children')
      .select('id,member_id,birth_date');


    const eventResponsesRes = await db
      .from('event_responses')
      .select('event_id,member_id');


    const pollResponsesRes = await db
      .from('poll_responses')
      .select('poll_id,member_id');


    const adminNotesRes = await db
      .from('admin_notes')
      .select(`
        id,
        title,
        content,
        created_at,
        active,
        recipient_type,
        recipient_member_id
      `)
      .order('created_at',{ascending:false});


    const adminNoteReadsRes = await db
      .from('admin_note_reads')
      .select(`
        note_id,
        member_id,
        read_at
      `);


    /* ========================================================
       ERREURS
       ======================================================== */

    if(eventsRes.error) throw eventsRes.error;
    if(pollsRes.error) throw pollsRes.error;
    if(membersRes.error) throw membersRes.error;
    if(listingsRes.error) throw listingsRes.error;
    if(ideasRes.error) throw ideasRes.error;
    if(reqsRes.error) throw reqsRes.error;
    if(reqItemsRes.error) throw reqItemsRes.error;
    if(materialsRes.error) throw materialsRes.error;
    if(childrenRes.error) throw childrenRes.error;
    if(adminNotesRes.error) throw adminNotesRes.error;
    if(adminNoteReadsRes.error) throw adminNoteReadsRes.error;


    if(eventResponsesRes.error){

      console.warn(
        'ADMIN - REPONSES FESTIVITES :',
        eventResponsesRes.error
      );

    }


    if(pollResponsesRes.error){

      console.warn(
        'ADMIN - REPONSES SONDAGES :',
        pollResponsesRes.error
      );

    }


    /* ========================================================
       TABLEAUX
       ======================================================== */

    const events = eventsRes.data || [];
    const polls = pollsRes.data || [];
    const members = membersRes.data || [];
    const listings = listingsRes.data || [];
    const ideas = ideasRes.data || [];
    const reqs = reqsRes.data || [];
    const reqItems = reqItemsRes.data || [];
    const materials = materialsRes.data || [];
    const children = childrenRes.data || [];

    const adminNotes =
      adminNotesRes.data || [];

    const adminNoteReads =
      adminNoteReadsRes.data || [];


    const eventResponses =
      eventResponsesRes.error
        ? []
        : (eventResponsesRes.data || []);


    const pollResponses =
      pollResponsesRes.error
        ? []
        : (pollResponsesRes.data || []);


    /* ========================================================
       ASSOCIATION DU MATÉRIEL
       ======================================================== */

    const materialMap = {};

    materials.forEach(m => {

      materialMap[String(m.id)] = m;

    });


    reqs.forEach(r => {

      r.material_request_items =
        reqItems
          .filter(item =>
            String(item.request_id) === String(r.id)
          )
          .map(item => ({
            ...item,
            materials:
              materialMap[String(item.material_id)] || null
          }));

    });


    /* ========================================================
       STATISTIQUES
       ======================================================== */

    const pendingRequests =
      reqs.filter(
        r =>
          String(r.status).toLowerCase() === 'pending'
      ).length;


    const newIdeas =
      ideas.filter(i =>
        String(i.status || '').toLowerCase() === 'new' ||
        String(i.status || '').toLowerCase() === 'nouvelle'
      ).length;


    /* ========================================================
       MESSAGES NON LUS
       ======================================================== */

    const adminUnreadMessagesRes = await db
      .from('conversation_participants')
      .select(`
        conversation_id,
        last_read_at
      `)
      .eq(
        'member_id',
        getCurrentMemberId()
      )
      .is(
        'deleted_at',
        null
      );


    if(adminUnreadMessagesRes.error){
      throw adminUnreadMessagesRes.error;
    }


    const adminParticipations =
      adminUnreadMessagesRes.data || [];


    let adminUnreadMessages = 0;


    for(
      const participation
      of adminParticipations
    ){

      let query =
        db
          .from('conversation_messages')
          .select(
            'id',
            {
              count:'exact',
              head:true
            }
          )
          .eq(
            'conversation_id',
            participation.conversation_id
          )
          .neq(
            'sender_id',
            getCurrentMemberId()
          );


      if(participation.last_read_at){

        query =
          query.gt(
            'created_at',
            participation.last_read_at
          );

      }


      const {
        count,
        error
      } = await query;


      if(error){
        throw error;
      }


      adminUnreadMessages +=
        count || 0;

    }


    /* ========================================================
       COMPOSITION
       ======================================================== */

    const activeMembers =
      members.filter(
        m =>
          String(m.status || '').toLowerCase() === 'actif'
      ).length;


    const retiredMembers =
      members.filter(
        m =>
          String(m.status || '').toLowerCase() === 'retraite'
      ).length;


    const bureauMembers =
      members.filter(
        m => m.bureau_member === true
      ).length;


    const todayDashboard = new Date();
const currentYear = todayDashboard.getFullYear();

const childrenUnder16 =
  children.filter(c => {

    if(!c.birth_date){
      return false;
    }

    const birth = new Date(c.birth_date);

    if(Number.isNaN(birth.getTime())){
      return false;
    }

    const age = currentYear - birth.getFullYear();

    return age >= 0 && age <= 16;

  }).length;


    /* ========================================================
       PRÊTS EN COURS
       ======================================================== */

    const currentLoans =
      reqs.filter(r => {

        if(
          String(r.status).toLowerCase() !==
          'approved'
        ){
          return false;
        }


        if(!r.start_date){
          return false;
        }


        const start =
          new Date(r.start_date);


        if(Number.isNaN(start.getTime())){
          return false;
        }


        if(start > todayDashboard){
          return false;
        }


        if(!r.return_date){
          return true;
        }


        const end =
          new Date(r.return_date);


        if(Number.isNaN(end.getTime())){
          return true;
        }


        return end >= todayDashboard;

      }).length;


    /* ========================================================
       RÉPONSES FESTIVITÉS
       ======================================================== */

    const eventResponseMap = {};


    eventResponses.forEach(r => {

      if(!r.event_id || !r.member_id){
        return;
      }


      const key =
        String(r.event_id);


      if(!eventResponseMap[key]){
        eventResponseMap[key] = new Set();
      }


      eventResponseMap[key].add(
        String(r.member_id)
      );

    });


    const pollResponseMap = {};


    pollResponses.forEach(r => {

      if(!r.poll_id || !r.member_id){
        return;
      }


      const key =
        String(r.poll_id);


      if(!pollResponseMap[key]){
        pollResponseMap[key] = new Set();
      }


      pollResponseMap[key].add(
        String(r.member_id)
      );

    });


    const getEventAnswered = id =>
      eventResponseMap[String(id)]?.size || 0;


    const getPollAnswered = id =>
      pollResponseMap[String(id)]?.size || 0;


    const totalPeople =
      members.length;


    /* ========================================================
       SUJETS DE RÉUNION
       ======================================================== */

    const {
      count: pendingMeetingSubjects,
      error: meetingSubjectsError
    } = await db
      .from('meeting_subjects')
      .select(
        'id',
        {
          count:'exact',
          head:true
        }
      )
      .eq(
        'status',
        'a_aborder'
      );


    if(meetingSubjectsError){
      throw meetingSubjectsError;
    }


    /* ========================================================
       STOCKAGE GLOBAL
       ======================================================== */

    adminDashboardData = {

      events,
      polls,
      members,
      listings,
      ideas,
      requests: reqs,
      materials,
      children,
      eventResponses,
      pollResponses,
      adminNotes,
      adminNoteReads,

      pendingMeetingSubjects:
        pendingMeetingSubjects || 0,

      activeMembers,
      retiredMembers,
      bureauMembers,
      childrenUnder16,
      currentLoans,

      pendingRequests,
      newIdeas,
      adminUnreadMessages,

      maintenanceActive,

      totalPeople,

      eventResponseMap,
      pollResponseMap

    };


    /* ========================================================
       DATE
       ======================================================== */

    const dateText =
      new Intl.DateTimeFormat(
        'fr-FR',
        {
          weekday:'long',
          day:'numeric',
          month:'long',
          year:'numeric'
        }
      ).format(new Date());


  /* ========================================================
   EN COURS - FESTIVITÉS
   ======================================================== */

const currentEventsHtml =
  events.length

  ? events
      .slice(0,4)
      .map(e => {

        const answered =
          getEventAnswered(e.id);

        const percent =
          totalPeople
            ? Math.min(
                100,
                Math.round(
                  (answered /
                    totalPeople) *
                  100
                )
              )
            : 0;


        const unanswered =
          Math.max(
            0,
            totalPeople - answered
          );


        return `

          <div
            class="admin-modern-item"
          >

            <div
              onclick="showAdminEventDetails('${e.id}')"
              style="cursor:pointer;"
            >

              <div class="admin-modern-item-top">

                <div>

                  <div class="admin-modern-item-title">
                    🎉 ${esc(
                      e.title ||
                      'Festivité'
                    )}
                  </div>

                  <div class="admin-modern-item-meta">
                    📅 ${fmtDate(e.event_date)}
                  </div>

                </div>

                <div class="admin-modern-percent">
                  ${percent}%
                </div>

              </div>


              <div class="admin-progress">

                <div
                  class="admin-progress-bar"
                  style="width:${percent}%"
                ></div>

              </div>


              <div class="admin-modern-small">
                ${answered} / ${totalPeople}
                membres ont répondu
              </div>

            </div>


            ${
              answered < totalPeople

              ? `

                <button
                  type="button"
                  class="ghost"
                  style="
                    width:100%;
                    margin-top:10px;
                  "
                  onclick="
                    event.stopPropagation();

                    if(
                      confirm(
                        '🔔 Relancer les non-répondants ?\\n\\n' +
                        '${unanswered} membre${unanswered > 1 ? 's' : ''} ' +
                        'n\\'${unanswered > 1 ? 'ont' : 'a'} pas encore répondu à la festivité « ${esc(e.title || 'Festivité')} ».\\n\\n' +
                        'Une notification leur sera envoyée.\\n\\n' +
                        'Continuer ?'
                      )
                    ){
                      remindEventNonResponders('${e.id}');
                    }
                  "
                >

                  🔔 Relancer les non-répondants
                  
                </button>

              `

              : `

                <div
                  class="admin-modern-small"
                  style="
                    margin-top:10px;
                    text-align:center;
                  "
                >

                  ✅ Tout le monde a répondu

                </div>

              `
            }

          </div>

        `;

      })
      .join('')

  : `

      <div class="admin-empty-small">
        🎉 Aucune festivité créée.
      </div>

    `;


/* ========================================================
   EN COURS - SONDAGES
   ======================================================== */

const currentPollsHtml =
  polls.length

  ? polls
      .slice(0,4)
      .map(p => {

        const answered =
          getPollAnswered(p.id);

        const percent =
          totalPeople
            ? Math.min(
                100,
                Math.round(
                  (answered /
                    totalPeople) *
                  100
                )
              )
            : 0;


        const unanswered =
          Math.max(
            0,
            totalPeople - answered
          );


        return `

          <div
            class="admin-modern-item"
          >

            <div
              onclick="pollRecap('${p.id}')"
              style="cursor:pointer;"
            >

              <div class="admin-modern-item-top">

                <div>

                  <div class="admin-modern-item-title">
                    📊 ${esc(
                      p.question ||
                      p.title ||
                      'Sondage'
                    )}
                  </div>

                  <div class="admin-modern-item-meta">
                    👥 Sondage en cours
                  </div>

                </div>

                <div class="admin-modern-percent">
                  ${percent}%
                </div>

              </div>


              <div class="admin-progress">

                <div
                  class="admin-progress-bar"
                  style="width:${percent}%"
                ></div>

              </div>


              <div class="admin-modern-small">
                ${answered} / ${totalPeople}
                membres ont répondu
              </div>

            </div>


            ${
              answered < totalPeople

              ? `

                <button
                  type="button"
                  class="ghost"
                  style="
                    width:100%;
                    margin-top:10px;
                  "
                  onclick="
                    event.stopPropagation();

                    if(
                      confirm(
                        '🔔 Relancer les non-répondants ?\\n\\n' +
                        '${unanswered} membre${unanswered > 1 ? 's' : ''} ' +
                        'n\\'${unanswered > 1 ? 'ont' : 'a'} pas encore répondu au sondage « ${esc(p.question || p.title || 'Sondage')} ».\\n\\n' +
                        'Une notification leur sera envoyée.\\n\\n' +
                        'Continuer ?'
                      )
                    ){
                      remindPollNonResponders('${p.id}');
                    }
                  "
                >

                  🔔 Relancer les non-répondants

                </button>

              `

              : `

                <div
                  class="admin-modern-small"
                  style="
                    margin-top:10px;
                    text-align:center;
                  "
                >

                  ✅ Tout le monde a répondu

                </div>

              `
            }

          </div>

        `;

      })
      .join('')

  : `

      <div class="admin-empty-small">
        📊 Aucun sondage créé.
      </div>

    `;
    /* ========================================================
       EN COURS - LISTINGS
       ======================================================== */

    const currentListingsHtml =
      listings.length

      ? listings
          .slice(0,4)
          .map(listing => `

            <div
              class="admin-modern-item"
              onclick="openListing('${listing.id}')"
            >

              <div class="admin-modern-item-top">

                <div>

                  <div class="admin-modern-item-title">
                    📋 ${esc(
                      listing.name ||
                      'Listing'
                    )}
                  </div>

                  <div class="admin-modern-item-meta">
                    Créé le ${fmtDate(listing.created_at)}
                  </div>

                </div>

                <div class="admin-modern-arrow">
                  ›
                </div>

              </div>

            </div>

          `)
          .join('')

      : `

        <div class="admin-empty-small">
          📋 Aucun listing créé.
        </div>

      `;


    /* ========================================================
       ACCUEIL ADMIN
       ======================================================== */

    $('homeAdmin').innerHTML = `

      <style>

        /* =====================================================
           BASE
           ===================================================== */

        .admin-modern-wrapper{
          width:100%;
          max-width:1250px;
          margin:0 auto;
          padding:10px 0 40px;
        }


        /* =====================================================
           HERO
           ===================================================== */

        .admin-modern-hero{

          position:relative;
          overflow:hidden;

          min-height:230px;

          display:flex;
          align-items:flex-end;

          padding:30px;

          border-radius:28px;

          color:#fff;

          margin-bottom:20px;

          background:
            linear-gradient(
              135deg,
              rgba(85,0,8,.90),
              rgba(181,18,27,.72)
            ),
            url('assets/fond');

          background-size:cover;
          background-position:center;

          box-shadow:
            0 18px 45px
            rgba(80,0,10,.20);

        }


        .admin-modern-hero-content{
          position:relative;
          z-index:2;
        }


        .admin-modern-hero-badge{

          display:inline-flex;
          align-items:center;
          gap:7px;

          padding:7px 12px;

          border-radius:999px;

          background:
            rgba(255,255,255,.14);

          border:
            1px solid
            rgba(255,255,255,.18);

          font-size:12px;
          font-weight:700;

          margin-bottom:12px;

          backdrop-filter:blur(8px);

        }


        .admin-modern-hero h1{

          margin:0;

          color:#fff;

          font-size:
            clamp(
              25px,
              4vw,
              38px
            );

          line-height:1.1;

        }


        .admin-modern-hero p{

          margin:9px 0 0;

          color:
            rgba(255,255,255,.90);

          font-size:15px;

        }


        /* =====================================================
           BOUTON MENU
           ===================================================== */

        .admin-menu-button{

          width:100%;

          display:flex;
          align-items:center;
          justify-content:center;

          gap:12px;

          border:none;

          border-radius:18px;

          padding:17px 20px;

          margin:
            20px 0;

          background:#111827;

          color:#fff;

          font-size:16px;

          font-weight:800;

          cursor:pointer;

          box-shadow:
            0 10px 25px
            rgba(0,0,0,.14);

          transition:
            transform .18s,
            box-shadow .18s;

        }


        .admin-menu-button:hover{

          transform:
            translateY(-2px);

          box-shadow:
            0 15px 30px
            rgba(0,0,0,.18);

        }


        .admin-menu-button .burger{
          font-size:24px;
        }


        /* =====================================================
           BLOC GENERIQUE
           ===================================================== */

        .admin-modern-section{

          background:#fff;

          border:
            1px solid
            #e5e7eb;

          border-radius:22px;

          padding:20px;

          margin-bottom:20px;

          box-shadow:
            0 8px 25px
            rgba(15,23,42,.05);

        }


        .admin-modern-section-header{

          display:flex;

          justify-content:
            space-between;

          align-items:center;

          gap:12px;

          margin-bottom:16px;

        }


        .admin-modern-section-title{

          display:flex;
          align-items:center;

          gap:10px;

          font-size:19px;
          font-weight:800;

        }


        .admin-modern-section-subtitle{

          color:#64748b;

          font-size:13px;

          margin-top:3px;

        }


        /* =====================================================
           COMPOSITION
           ===================================================== */

        .admin-composition-grid{

          display:grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(145px,1fr)
            );

          gap:12px;

        }


        .admin-stat-card{

          border:
            1px solid
            #e5e7eb;

          border-radius:17px;

          padding:17px;

          cursor:pointer;

          background:
            linear-gradient(
              180deg,
              #fff,
              #f8fafc
            );

          transition:
            transform .18s,
            box-shadow .18s;

        }


        .admin-stat-card:hover{

          transform:
            translateY(-2px);

          box-shadow:
            0 10px 22px
            rgba(15,23,42,.08);

        }


        .admin-stat-icon{

          font-size:22px;

          margin-bottom:9px;

        }


        .admin-stat-number{

          font-size:27px;

          font-weight:900;

          color:#111827;

        }


        .admin-stat-label{

          color:#64748b;

          font-size:13px;

          margin-top:3px;

        }


        /* =====================================================
           ELEMENTS À TRAITER
           ===================================================== */

        .admin-action-grid{

          display:grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(210px,1fr)
            );

          gap:12px;

        }


        .admin-action-card{

          border:
            1px solid
            #e5e7eb;

          border-radius:17px;

          padding:17px;

          background:#fff;

          cursor:pointer;

          transition:
            transform .18s,
            box-shadow .18s;

        }


        .admin-action-card:hover{

          transform:
            translateY(-2px);

          box-shadow:
            0 10px 24px
            rgba(15,23,42,.08);

        }


        .admin-action-icon{

          width:42px;
          height:42px;

          display:flex;
          align-items:center;
          justify-content:center;

          border-radius:13px;

          background:#f8fafc;

          font-size:21px;

          margin-bottom:11px;

        }


        .admin-action-number{

          font-size:23px;
          font-weight:900;

        }


        .admin-action-label{

          color:#64748b;

          font-size:13px;

          margin-top:3px;

        }


        /* =====================================================
           EN COURS
           ===================================================== */

        .admin-current-grid{

          display:grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(270px,1fr)
            );

          gap:15px;

        }


        .admin-current-column{

          border:
            1px solid
            #e5e7eb;

          border-radius:18px;

          padding:15px;

          background:#f8fafc;

        }


        .admin-current-column-title{

          font-weight:800;

          margin-bottom:12px;

          display:flex;

          align-items:center;

          justify-content:space-between;

        }


        .admin-current-column-count{

          min-width:27px;
          height:27px;

          display:flex;
          align-items:center;
          justify-content:center;

          border-radius:999px;

          background:#fff;

          border:
            1px solid
            #e5e7eb;

          font-size:12px;

        }


        .admin-modern-item{

          background:#fff;

          border:
            1px solid
            #e5e7eb;

          border-radius:15px;

          padding:13px;

          margin-bottom:9px;

          cursor:pointer;

          transition:
            transform .16s,
            box-shadow .16s;

        }


        .admin-modern-item:last-child{
          margin-bottom:0;
        }


        .admin-modern-item:hover{

          transform:
            translateY(-1px);

          box-shadow:
            0 7px 18px
            rgba(15,23,42,.07);

        }


        .admin-modern-item-top{

          display:flex;

          justify-content:
            space-between;

          align-items:flex-start;

          gap:10px;

        }


        .admin-modern-item-title{

          font-size:14px;

          font-weight:800;

          line-height:1.35;

        }


        .admin-modern-item-meta{

          color:#64748b;

          font-size:12px;

          margin-top:4px;

        }


        .admin-modern-percent{

          font-weight:900;

          font-size:13px;

        }


        .admin-modern-arrow{

          font-size:23px;

          color:#94a3b8;

        }


        .admin-modern-small{

          color:#64748b;

          font-size:11px;

          margin-top:7px;

        }


        .admin-progress{

          height:7px;

          border-radius:999px;

          overflow:hidden;

          background:#e5e7eb;

          margin-top:10px;

        }


        .admin-progress-bar{

          height:100%;

          background:#b5121b;

          border-radius:999px;

          transition:width .3s;

        }


        .admin-progress-bar.blue{

          background:#2563eb;

        }


        .admin-empty-small{

          color:#94a3b8;

          font-size:13px;

          padding:10px 2px;

        }


        /* =====================================================
           RACCOURCIS
           ===================================================== */

        .admin-shortcuts{

          display:grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(190px,1fr)
            );

          gap:14px;

        }


        .admin-shortcut{

          border:none;

          border-radius:20px;

          padding:22px;

          min-height:130px;

          background:#fff;

          border:
            1px solid
            #e5e7eb;

          cursor:pointer;

          text-align:left;

          transition:
            transform .18s,
            box-shadow .18s;

        }


        .admin-shortcut:hover{

          transform:
            translateY(-3px);

          box-shadow:
            0 12px 25px
            rgba(15,23,42,.09);

        }


        .admin-shortcut-icon{

          font-size:29px;

          margin-bottom:12px;

        }


        .admin-shortcut-title{

          font-weight:900;

          font-size:16px;

        }


        .admin-shortcut-text{

          color:#64748b;

          font-size:12px;

          margin-top:5px;

        }


        /* =====================================================
           POPUP
           ===================================================== */

        .admin-popup-overlay{

          position:fixed;

          inset:0;

          z-index:99999;

          display:flex;

          align-items:center;

          justify-content:center;

          padding:15px;

          background:
            rgba(15,23,42,.60);

          backdrop-filter:
            blur(5px);

        }


        .admin-popup{

          width:
            min(
              700px,
              100%
            );

          max-height:
            calc(100vh - 30px);

          overflow:auto;

          background:#fff;

          border-radius:24px;

          box-shadow:
            0 25px 70px
            rgba(0,0,0,.28);

          animation:
            adminPopupIn .18s ease-out;

        }


        @keyframes adminPopupIn{

          from{

            opacity:0;

            transform:
              translateY(12px)
              scale(.98);

          }

          to{

            opacity:1;

            transform:
              translateY(0)
              scale(1);

          }

        }


        .admin-popup-header{

          position:sticky;

          top:0;

          z-index:2;

          display:flex;

          align-items:center;

          justify-content:
            space-between;

          gap:15px;

          padding:18px 20px;

          background:#fff;

          border-bottom:
            1px solid
            #e5e7eb;

        }


        .admin-popup-title{

          font-size:18px;

          font-weight:900;

        }


        .admin-popup-close{

          width:42px;
          height:42px;

          border:none;

          border-radius:13px;

          background:#f1f5f9;

          color:#111827;

          font-size:22px;

          cursor:pointer;

          display:flex;

          align-items:center;
          justify-content:center;

        }


        .admin-popup-close:hover{

          background:#e2e8f0;

        }


        .admin-popup-body{

          padding:20px;

        }


        .admin-popup-footer{

          display:flex;

          justify-content:flex-end;

          gap:10px;

          padding:15px 20px;

          border-top:
            1px solid
            #e5e7eb;

        }


        .admin-menu-list{

          display:flex;

          flex-direction:column;

          gap:8px;

        }


        .admin-menu-row{

          width:100%;

          border:none;

          border-radius:16px;

          background:#f8fafc;

          padding:16px;

          display:flex;

          align-items:center;

          gap:14px;

          cursor:pointer;

          text-align:left;

          transition:
            background .16s,
            transform .16s;

        }


        .admin-menu-row:hover{

          background:#f1f5f9;

          transform:
            translateX(2px);

        }


        .admin-menu-row-icon{

          width:42px;
          height:42px;

          display:flex;

          align-items:center;
          justify-content:center;

          background:#fff;

          border-radius:13px;

          font-size:20px;

          flex:none;

        }


        .admin-menu-row-content{
          flex:1;
        }


        .admin-menu-row-title{

          font-weight:800;

          font-size:14px;

        }


        .admin-menu-row-text{

          color:#64748b;

          font-size:12px;

          margin-top:3px;

        }


        .admin-menu-arrow{

          color:#94a3b8;

          font-size:21px;

        }


        .admin-detail-stat{

          display:grid;

          grid-template-columns:
            repeat(
              auto-fit,
              minmax(130px,1fr)
            );

          gap:10px;

          margin-top:15px;

        }


        .admin-detail-stat-box{

          background:#f8fafc;

          border:
            1px solid
            #e5e7eb;

          border-radius:15px;

          padding:14px;

        }


        .admin-detail-stat-number{

          font-size:22px;

          font-weight:900;

        }


        .admin-detail-stat-label{

          color:#64748b;

          font-size:12px;

          margin-top:3px;

        }


        .admin-detail-section{

          margin-top:20px;

          padding-top:20px;

          border-top:
            1px solid
            #e5e7eb;

        }


        @media(max-width:600px){

          .admin-modern-wrapper{
            padding:5px 0 30px;
          }

          .admin-modern-hero{
            min-height:200px;
            padding:22px;
            border-radius:22px;
          }

          .admin-modern-section{
            padding:15px;
            border-radius:19px;
          }

          .admin-popup-overlay{
            align-items:flex-end;
            padding:0;
          }

          .admin-popup{

            width:100%;

            max-height:
              92vh;

            border-radius:
              24px 24px 0 0;

          }

          .admin-popup-body{
            padding:17px;
          }

          .admin-popup-footer{
            padding:
              12px 17px;

          }

        }

      </style>


      <div class="admin-modern-wrapper">

<!-- =========================================================
     TABLEAU DE BORD ADMINISTRATEUR
========================================================= -->

<div
  style="
    position:relative;
    overflow:hidden;
    width:100%;
    min-height:330px;
    margin-bottom:28px;
    border-radius:26px;

    box-shadow:
      0 16px 40px rgba(0,0,0,.16);

    border:1px solid rgba(255,255,255,.30);
  "
>

  <!-- IMAGE DE FOND -->
  <img
    src="assets/fond.png"
    alt=""
    style="
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
      object-position:center;
      z-index:0;
    "
  >

  <!-- VOILE TRÈS LÉGER -->
  <div
    style="
      position:absolute;
      inset:0;
      z-index:1;

      background:
        linear-gradient(
          90deg,
          rgba(0,0,0,.48) 0%,
          rgba(0,0,0,.18) 45%,
          rgba(0,0,0,.08) 100%
        );
    "
  ></div>


  <!-- CONTENU -->
  <div
    style="
      position:relative;
      z-index:2;

      min-height:330px;
      padding:32px 38px;

      display:flex;
      flex-direction:column;
      justify-content:space-between;

      color:#fff;
    "
  >

    <!-- =====================================================
         EN-TÊTE
    ====================================================== -->

    <div
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:25px;
        flex-wrap:wrap;
      "
    >

      <!-- IDENTITÉ -->

      <div
        style="
          display:inline-flex;
          align-items:center;
          gap:13px;

          padding:11px 20px;

          border-radius:16px;

          background:rgba(255,255,255,.88);

          box-shadow:
            0 8px 22px rgba(0,0,0,.12);

          color:#222;
        "
      >

        <span
          style="
            font-size:28px;
            line-height:1;
          "
        >
          🚒
        </span>

        <div>

          <div
            style="
              font-size:16px;
              line-height:1.1;
              font-weight:900;
              color:#d92727;
            "
          >
            AMICALE DES SAPEURS-POMPIERS
          </div>

          <div
            style="
              margin-top:3px;
              font-size:12px;
              font-weight:700;
              letter-spacing:.18em;
              color:#555;
            "
          >
            DE BAILLEUL
          </div>

        </div>

      </div>

    </div>


    <!-- =====================================================
         CENTRE
    ====================================================== -->

    <div
      style="
        display:flex;
        align-items:center;
        justify-content:space-between;

        gap:35px;

        flex:1;
        padding:20px 0;
      "
    >

      <!-- TITRE -->

      <div
        style="
          flex:1;
        "
      >

        <h1
          style="
            margin:0;

            font-size:clamp(40px,5vw,68px);
            line-height:1;

            font-weight:900;

            color:#fff;

            letter-spacing:-.035em;

            text-shadow:
              0 3px 10px rgba(0,0,0,.35);
          "
        >
          Tableau de bord
        </h1>

        <p
          style="
            margin:12px 0 0;

            font-size:clamp(16px,2vw,21px);

            font-weight:500;

            color:rgba(255,255,255,.94);

            text-shadow:
              0 2px 7px rgba(0,0,0,.35);
          "
        >
          Gestion de l'Amicale des Sapeurs-Pompiers de Bailleul
        </p>

      </div>


      <!-- ===================================================
           DATE DU JOUR
      ==================================================== -->

      <div
        style="
          flex-shrink:0;

          width:235px;
          min-height:145px;

          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;

          padding:20px;

          border-radius:22px;

          background:
            rgba(255,255,255,.82);

          border:
            1px solid rgba(255,255,255,.75);

          box-shadow:
            0 12px 30px rgba(0,0,0,.14);

          backdrop-filter:blur(10px);
          -webkit-backdrop-filter:blur(10px);

          text-align:center;

          color:#202633;
        "
      >

        <div
          style="
            font-size:11px;
            font-weight:800;
            letter-spacing:.16em;
            color:#777;
            text-transform:uppercase;
          "
        >
          AUJOURD'HUI
        </div>

        <div
          style="
            width:55px;
            height:2px;

            margin:10px 0;

            background:#d92727;

            border-radius:5px;
          "
        ></div>

        <div
          style="
            font-size:19px;
            line-height:1.35;

            font-weight:800;

            color:#202633;
          "
        >
          ${new Date().toLocaleDateString(
            'fr-FR',
            {
              weekday:'long',
              day:'numeric',
              month:'long',
              year:'numeric'
            }
          )}
        </div>

      </div>

    </div>


    <!-- =====================================================
         INFORMATIONS DU TABLEAU DE BORD
         PAS DE BLOCS SUPPLÉMENTAIRES ICI
    ====================================================== -->

    <div
      style="
        display:flex;
        align-items:center;
        justify-content:flex-start;
        gap:10px;

        font-size:13px;
        font-weight:600;

        color:rgba(255,255,255,.88);

        text-shadow:
          0 1px 5px rgba(0,0,0,.35);
      "
    >

      <span
        style="
          width:8px;
          height:8px;
          border-radius:50%;
          background:#fff;
          display:inline-block;
          box-shadow:0 0 8px rgba(255,255,255,.7);
        "
      ></span>

      Espace d'administration

    </div>

  </div>

</div>
        <!-- ==================================================
             COMPOSITION
             ================================================== -->

        <section class="admin-modern-section">

          <div class="admin-modern-section-header">

            <div>

              <div class="admin-modern-section-title">
                👥 Composition de l'Amicale
              </div>

              <div class="admin-modern-section-subtitle">
                Vue rapide de la composition actuelle
              </div>

            </div>

            <button
              type="button"
              class="secondary"
              onclick="showAdminComposition('members')"
            >
              Voir
            </button>

          </div>


          <div class="admin-composition-grid">


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('members')"
            >

              <div class="admin-stat-icon">
                👥
              </div>

              <div class="admin-stat-number">
                ${members.length}
              </div>

              <div class="admin-stat-label">
                Membres
              </div>

            </div>


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('active')"
            >

              <div class="admin-stat-icon">
                🟢
              </div>

              <div class="admin-stat-number">
                ${activeMembers}
              </div>

              <div class="admin-stat-label">
                Actifs
              </div>

            </div>


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('retired')"
            >

              <div class="admin-stat-icon">
                ⚪
              </div>

              <div class="admin-stat-number">
                ${retiredMembers}
              </div>

              <div class="admin-stat-label">
                Retraités
              </div>

            </div>


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('bureau')"
            >

              <div class="admin-stat-icon">
                👔
              </div>

              <div class="admin-stat-number">
                ${bureauMembers}
              </div>

              <div class="admin-stat-label">
                Membres du bureau
              </div>

            </div>


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('children')"
            >

              <div class="admin-stat-icon">
                👨‍👩‍👧
              </div>

              <div class="admin-stat-number">
                ${childrenUnder16}
              </div>

              <div class="admin-stat-label">
                Enfants -16 ans
              </div>

            </div>


            <div
              class="admin-stat-card"
              onclick="showAdminComposition('loans')"
            >

              <div class="admin-stat-icon">
                🧰
              </div>

              <div class="admin-stat-number">
                ${currentLoans}
              </div>

              <div class="admin-stat-label">
                Prêts en cours
              </div>

            </div>


          </div>

        </section>


        <!-- ==================================================
             ELEMENTS À TRAITER
             ================================================== -->

        <section class="admin-modern-section">

          <div class="admin-modern-section-header">

            <div>

              <div class="admin-modern-section-title">
                🔔 Éléments à traiter
              </div>

              <div class="admin-modern-section-subtitle">
                Les informations nécessitant votre attention
              </div>

            </div>

          </div>


          <div class="admin-action-grid">


            <div
              class="admin-action-card"
              onclick="showAdminIdeasSection()"
            >

              <div class="admin-action-icon">
                💡
              </div>

              <div class="admin-action-number">
                ${newIdeas}
              </div>

              <div class="admin-action-label">
                nouvelle${newIdeas > 1 ? 's' : ''}
                idée${newIdeas > 1 ? 's' : ''}
              </div>

            </div>


            <div
              class="admin-action-card"
              onclick="showAdminMaterialRequests()"
            >

              <div class="admin-action-icon">
                🧰
              </div>

              <div class="admin-action-number">
                ${pendingRequests}
              </div>

              <div class="admin-action-label">
                demande${pendingRequests > 1 ? 's' : ''}
                de matériel en attente
              </div>

            </div>


            <div
              class="admin-action-card"
              onclick="openMessaging()"
            >

              <div class="admin-action-icon">
                💬
              </div>

              <div class="admin-action-number">
                ${adminUnreadMessages}
              </div>

              <div class="admin-action-label">
                message${adminUnreadMessages > 1 ? 's' : ''}
                non lu${adminUnreadMessages > 1 ? 's' : ''}
              </div>

            </div>


            <div
              class="admin-action-card"
              onclick="showAdminMeetingSubjects()"
            >

              <div class="admin-action-icon">
                🗣️
              </div>

              <div class="admin-action-number">
                ${pendingMeetingSubjects || 0}
              </div>

              <div class="admin-action-label">
                sujet${(pendingMeetingSubjects || 0) > 1 ? 's' : ''}
                à aborder
              </div>

            </div>


          </div>

        </section>


        <!-- ==================================================
             EN COURS
             ================================================== -->

        <section class="admin-modern-section">

          <div class="admin-modern-section-header">

            <div>

              <div class="admin-modern-section-title">
                🔄 En cours
              </div>

              <div class="admin-modern-section-subtitle">
                Activités actuellement disponibles ou actives
              </div>

            </div>

          </div>


          <div class="admin-current-grid">


            <!-- FESTIVITÉS -->

            <div class="admin-current-column">

              <div class="admin-current-column-title">

                <span>
                  🎉 Festivités
                </span>

                <span class="admin-current-column-count">
                  ${events.length}
                </span>

              </div>

              ${currentEventsHtml}

            </div>


            <!-- SONDAGES -->

            <div class="admin-current-column">

              <div class="admin-current-column-title">

                <span>
                  📊 Sondages
                </span>

                <span class="admin-current-column-count">
                  ${polls.length}
                </span>

              </div>

              ${currentPollsHtml}

            </div>


            <!-- LISTINGS -->

            <div class="admin-current-column">

              <div class="admin-current-column-title">

                <span>
                  📋 Listings
                </span>

                <span class="admin-current-column-count">
                  ${listings.length}
                </span>

              </div>

              ${currentListingsHtml}

            </div>


          </div>

        </section>


        <!-- ==================================================
             RACCOURCIS
             ================================================== -->

        <section class="admin-shortcuts">


          <button
            type="button"
            class="admin-shortcut"
            onclick="showCalendarAdmin()"
          >

            <div class="admin-shortcut-icon">
              📅
            </div>

            <div class="admin-shortcut-title">
              Calendrier
            </div>

            <div class="admin-shortcut-text">
              Calendrier et événements de l'Amicale
            </div>

          </button>


          <button
            type="button"
            class="admin-shortcut"
            onclick="openMessaging()"
          >

            <div class="admin-shortcut-icon">
              💬
            </div>

            <div class="admin-shortcut-title">
              Messagerie
            </div>

            <div class="admin-shortcut-text">
              Retrouvez toutes vos conversations
            </div>

          </button>


          <button
            type="button"
            class="admin-shortcut"
            onclick="showAdminWorkDocuments()"
          >

            <div class="admin-shortcut-icon">
              📄
            </div>

            <div class="admin-shortcut-title">
              Travail de l'Amicale
            </div>

            <div class="admin-shortcut-text">
              Documents de travail du bureau
            </div>

          </button>


        </section>


        <!-- ==================================================
             MENU ADMINISTRATEUR
             ================================================== -->

        <button
          type="button"
          class="admin-menu-button"
          onclick="openAdminMenu()"
        >

          <span class="burger">
            ☰
          </span>

          <span>
            Menu administrateur
          </span>

        </button>


      </div>

    `;


    /* ========================================================
       DOCUMENTS
       ======================================================== */

    setTimeout(() => {

      if(
        typeof loadAdminWorkDocumentsHome ===
        'function'
      ){

        loadAdminWorkDocumentsHome();

      }

    },100);


  }catch(error){

    console.error(
      'ERREUR RENDER ADMIN :',
      error
    );


    $('homeAdmin').innerHTML = `

      <div class="card">

        <h2>
          ❌ Erreur
        </h2>

        <p>
          Impossible de charger
          le tableau de bord administrateur.
        </p>

        <p class="error">
          ${esc(
            error?.message ||
            'Erreur inconnue'
          )}
        </p>

        <button
          type="button"
          class="primary"
          onclick="renderAdmin()"
        >
          🔄 Réessayer
        </button>

      </div>

    `;

  }

}


/* ============================================================
   POPUP ADMIN
   ============================================================ */

function closeAdminPopup(){

  const popup =
    document.getElementById(
      'adminModernPopup'
    );

  if(popup){

    popup.remove();

  }

  document.body.style.overflow = '';

}


/* ============================================================
   OUVRIR POPUP GÉNÉRIQUE
   ============================================================ */

function openAdminPopup(
  title,
  content,
  footer = ''
){

  closeAdminPopup();


  const popup =
    document.createElement('div');

  popup.id =
    'adminModernPopup';

  popup.className =
    'admin-popup-overlay';


  popup.innerHTML = `

    <div
      class="admin-popup"
      role="dialog"
      aria-modal="true"
      aria-label="${esc(title)}"
      onclick="event.stopPropagation()"
    >

      <div class="admin-popup-header">

        <div class="admin-popup-title">
          ${title}
        </div>

        <button
          type="button"
          class="admin-popup-close"
          aria-label="Fermer"
          onclick="closeAdminPopup()"
        >
          ✕
        </button>

      </div>


      <div class="admin-popup-body">

        ${content}

      </div>


      <div class="admin-popup-footer">

        ${
          footer ||

          `
            <button
              type="button"
              class="secondary"
              onclick="closeAdminPopup()"
            >
              ✕ Fermer
            </button>
          `
        }

      </div>

    </div>

  `;


  popup.addEventListener(
    'click',
    event => {

      if(
        event.target === popup
      ){

        closeAdminPopup();

      }

    }
  );


  document.body.appendChild(
    popup
  );


  document.body.style.overflow =
    'hidden';


  setTimeout(() => {

    popup
      .querySelector(
        '.admin-popup-close'
      )
      ?.focus();

  },50);

}


/* ============================================================
   ESCAPE POUR FERMER
   ============================================================ */

document.addEventListener(
  'keydown',
  function adminPopupEscapeHandler(event){

    if(
      event.key === 'Escape' &&
      document.getElementById(
        'adminModernPopup'
      )
    ){

      closeAdminPopup();

    }

  }
);


/* ============================================================
   PROCURATIONS — MEMBRES ET ADMINISTRATEURS
   ============================================================ */


/* ============================================================
   ESPACE MEMBRE : DONNER OU RETIRER UNE PROCURATION
   ============================================================ */

async function showProcurations(){

  if(!member || !member.id){
    alert("Impossible d'identifier le membre connecté.");
    return;
  }

  openModal(`
    <div style="max-width:650px;margin:auto;padding:10px;">

      <h2 style="margin-top:0;color:#c8101e;">
        📝 Mes procurations
      </h2>

      <p style="color:#64748b;">
        Choisissez l'assemblée et le membre à qui vous souhaitez
        donner votre procuration.
      </p>

      <div id="procurationsMemberContent">
        Chargement...
      </div>

      <button type="button"
        onclick="closeModal()"
        style="margin-top:18px;padding:12px 18px;border:0;
        border-radius:10px;background:#e5e7eb;cursor:pointer;">
        Fermer
      </button>

    </div>
  `);

  try{

    const {data:assemblies,error:assemblyError} = await db
      .from('procuration_assemblies')
      .select('*')
      .eq('is_published',true)
      .order('meeting_date',{ascending:true});

    if(assemblyError) throw assemblyError;

    const container = document.getElementById(
      'procurationsMemberContent'
    );

    if(!assemblies || assemblies.length === 0){
      container.innerHTML = `
        <div style="padding:20px;background:#f3f4f6;
        border-radius:12px;text-align:center;">
          Aucune assemblée n'est actuellement ouverte aux procurations.
        </div>
      `;
      return;
    }

    const {data:membersList,error:membersError} = await db
      .from('members')
      .select('id,first_name,last_name')
      .order('last_name');

    if(membersError) throw membersError;

    let html = '';

    for(const assembly of assemblies){

      const {data:existing,error:existingError} = await db
        .from('procurations')
        .select('*')
        .eq('assembly_id',assembly.id)
        .eq('grantor_member_id',member.id)
        .maybeSingle();

      if(existingError) throw existingError;

      const options = (membersList || [])
        .filter(m => String(m.id) !== String(member.id))
        .map(m => `
          <option value="${esc(m.id)}"
            ${existing && String(existing.receiver_member_id) === String(m.id) ? 'selected' : ''}>
            ${esc((m.first_name || '') + ' ' + (m.last_name || ''))}
          </option>
        `).join('');

      html += `
        <div style="padding:18px;margin-bottom:15px;
          border:1px solid #e5e7eb;border-radius:14px;">

          <div style="font-weight:800;font-size:17px;">
            Assemblée du ${fmtDate(assembly.meeting_date)}
          </div>

          <label style="display:block;margin-top:15px;font-weight:700;">
            Je donne ma procuration à :
          </label>

          <select id="proxyReceiver_${esc(assembly.id)}"
            style="width:100%;padding:12px;margin-top:7px;
            border:1px solid #cbd5e1;border-radius:9px;">
            <option value="">Choisir un membre</option>
            ${options}
          </select>

          <label style="display:flex;gap:9px;align-items:flex-start;
            margin-top:14px;font-size:13px;">
            <input type="checkbox"
              id="proxyConfirm_${esc(assembly.id)}"
              ${existing?.declaration_confirmed ? 'checked' : ''}>
            Je certifie donner mandat à la personne désignée ci-dessus afin
  de me représenter et de voter en mon nom lors de cette assemblée
  générale. Je confirme l'exactitude des informations renseignées.
          </label>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:15px;">

            <button type="button"
              onclick="saveMyProcuration('${esc(assembly.id)}')"
              style="padding:11px 15px;background:#c8101e;
              color:white;border:0;border-radius:9px;font-weight:700;
              cursor:pointer;">
              ${existing ? 'Modifier ma procuration' : 'Valider ma procuration'}
            </button>

            ${existing ? `
              <button type="button"
                onclick="deleteMyProcuration('${esc(assembly.id)}')"
                style="padding:11px 15px;background:#e5e7eb;
                border:0;border-radius:9px;cursor:pointer;">
                Retirer ma procuration
              </button>
            ` : ''}

          </div>

        </div>
      `;
    }

    container.innerHTML = html;

  }catch(error){

    console.error('Erreur procurations membre :',error);

    document.getElementById('procurationsMemberContent').innerHTML = `
      <div style="color:#b91c1c;padding:15px;">
        Impossible de charger les procurations.
        ${esc(error.message)}
      </div>
    `;
  }
}


/* ============================================================
   ENREGISTRER / MODIFIER UNE PROCURATION
   ============================================================ */

async function saveMyProcuration(assemblyId){

  if(!member?.id) return;

  const receiver = document.getElementById(
    'proxyReceiver_' + assemblyId
  )?.value;

  const confirmed = document.getElementById(
    'proxyConfirm_' + assemblyId
  )?.checked;

  if(!receiver){
    alert("Veuillez choisir un membre.");
    return;
  }

  if(!confirmed){
    alert("Veuillez confirmer votre procuration.");
    return;
  }

  if(String(receiver) === String(member.id)){
    alert("Vous ne pouvez pas vous donner une procuration à vous-même.");
    return;
  }

  try{

    const {data:assembly,error:assemblyError} = await db
      .from('procuration_assemblies')
      .select('id,meeting_date,is_published')
      .eq('id',assemblyId)
      .eq('is_published',true)
      .single();

    if(assemblyError || !assembly){
      throw new Error("Cette assemblée n'est plus ouverte.");
    }

    const {error} = await db
      .from('procurations')
      .upsert({
        assembly_id:assemblyId,
        grantor_member_id:member.id,
        receiver_member_id:receiver,
        declaration_confirmed:true
      },{
        onConflict:'assembly_id,grantor_member_id'
      });

    if(error) throw error;

    alert("Votre procuration a bien été enregistrée.");

    await showProcurations();

  }catch(error){

    console.error(error);

    alert(
      "Impossible d'enregistrer la procuration. " +
      "Vérifiez que le membre choisi ne reçoit pas déjà une autre procuration.\n\n" +
      error.message
    );
  }
}


/* ============================================================
   RETIRER UNE PROCURATION
   ============================================================ */

async function deleteMyProcuration(assemblyId){

  if(!member?.id) return;

  if(!confirm("Voulez-vous vraiment retirer votre procuration ?")){
    return;
  }

  try{

    const {error} = await db
      .from('procurations')
      .delete()
      .eq('assembly_id',assemblyId)
      .eq('grantor_member_id',member.id);

    if(error) throw error;

    alert("Votre procuration a été retirée.");

    await showProcurations();

  }catch(error){

    console.error(error);

    alert("Erreur lors du retrait : " + error.message);
  }
}


/* ============================================================
   ADMINISTRATEUR : GESTION DES PROCURATIONS
   ============================================================ */

async function openAdminProcurations(){

  openAdminPopup(
    '📝 Gestion des procurations',
    `
      <div style="padding:5px;">

        <h3 style="margin-top:0;">Créer une assemblée</h3>

        <label style="display:block;font-weight:700;margin-bottom:7px;">
          Date de l'assemblée
        </label>

        <input type="date"
          id="proxyAssemblyDate"
          style="width:100%;padding:12px;border:1px solid #cbd5e1;
          border-radius:9px;">

        <button type="button"
          onclick="createProxyAssembly()"
          style="width:100%;margin-top:12px;padding:13px;
          background:#c8101e;color:white;border:0;border-radius:9px;
          font-weight:800;cursor:pointer;">
          Publier l'assemblée
        </button>

        <hr style="margin:22px 0;border:0;border-top:1px solid #e5e7eb;">

        <h3>Assemblées et procurations</h3>

        <div id="adminProcurationsList">
          Chargement...
        </div>

      </div>
    `
  );

  await loadAdminProcurations();
}


/* ============================================================
   CRÉER UNE ASSEMBLÉE
   ============================================================ */

async function createProxyAssembly(){

  const date = document.getElementById(
    'proxyAssemblyDate'
  )?.value;

  if(!date){
    alert("Veuillez sélectionner une date.");
    return;
  }

  try{

    const {error} = await db
      .from('procuration_assemblies')
      .insert({
        meeting_date:date,
        is_published:true
      });

    if(error) throw error;

    alert("L'assemblée a été publiée.");

    await loadAdminProcurations();

  }catch(error){

    console.error(error);

    alert("Erreur lors de la création : " + error.message);
  }
}


/* ============================================================
   CHARGER LES ASSEMBLÉES CÔTÉ ADMINISTRATEUR
   ============================================================ */

async function loadAdminProcurations(){

  const container = document.getElementById(
    'adminProcurationsList'
  );

  if(!container) return;

  try{

    const {data:assemblies,error} = await db
      .from('procuration_assemblies')
      .select('*')
      .order('meeting_date',{ascending:false});

    if(error) throw error;

    if(!assemblies || assemblies.length === 0){
      container.innerHTML = `
        <p style="color:#64748b;">
          Aucune assemblée créée.
        </p>
      `;
      return;
    }

    container.innerHTML = assemblies.map(a => `
      <div style="padding:14px;margin-bottom:10px;
        border:1px solid #e5e7eb;border-radius:12px;">

        <div style="font-weight:800;">
          Assemblée du ${fmtDate(a.meeting_date)}
        </div>

        <div style="margin-top:5px;font-size:13px;color:#64748b;">
          ${a.is_published ? 'Publiée' : 'Non publiée'}
        </div>

        <button type="button"
          onclick="viewAdminProcurations('${esc(a.id)}')"
          style="margin-top:10px;padding:10px 13px;
          border:0;border-radius:8px;background:#c8101e;
          color:white;font-weight:700;cursor:pointer;">
          Consulter les procurations
        </button>

        <button type="button"
          onclick="toggleProxyAssembly('${esc(a.id)}',${!a.is_published})"
          style="margin-top:10px;margin-left:5px;padding:10px 13px;
          border:0;border-radius:8px;background:#e5e7eb;
          cursor:pointer;">
          ${a.is_published ? 'Fermer les procurations' : 'Publier'}
        </button>

<button class="secondary"
  style="background:#b91c1c;color:white;border:0"
  onclick="deleteProcurationAssembly('${a.id}')">
  Supprimer l'assemblée
</button>
      </div>
    `).join('');

  }catch(error){

    console.error(error);

    container.innerHTML = `
      <p style="color:#b91c1c;">
        Erreur : ${esc(error.message)}
      </p>
    `;
  }
}


/* ============================================================
   SUPPRESSION D'UNE ASSEMBLÉE ET DE SES PROCURATIONS
   ADMINISTRATEUR UNIQUEMENT
   ============================================================ */

window.deleteProcurationAssembly = async function(id){

  const confirmation = confirm(
    "ATTENTION : suppression définitive\n\n" +
    "Vous allez supprimer cette assemblée ainsi que toutes les " +
    "procurations enregistrées pour celle-ci.\n\n" +
    "Cette opération est irréversible.\n\n" +
    "Confirmez-vous la suppression ?"
  );

  if(!confirmation) return;

  try{

    // Suppression des procurations associées
    const {error:proxyError} = await db
      .from('procurations')
      .delete()
      .eq('assembly_id',id);

    if(proxyError) throw proxyError;

    // Suppression de l'assemblée
    const {error:assemblyError} = await db
      .from('procuration_assemblies')
      .delete()
      .eq('id',id);

    if(assemblyError) throw assemblyError;

    alert(
      "L'assemblée et l'ensemble des procurations associées " +
      "ont été supprimés."
    );

    window.openAdminProcurations();

  }catch(error){

    console.error(
      "Erreur suppression assemblée :",
      error
    );

    alert(
      "La suppression n'a pas pu être effectuée.\n\n" +
      error.message
    );
  }
};

/* ============================================================
   PUBLIER / FERMER UNE ASSEMBLÉE
   ============================================================ */

async function toggleProxyAssembly(assemblyId,newState){

  try{

    const {error} = await db
      .from('procuration_assemblies')
      .update({is_published:newState})
      .eq('id',assemblyId);

    if(error) throw error;

    await loadAdminProcurations();

  }catch(error){

    console.error(error);

    alert("Erreur : " + error.message);
  }
}


/* ============================================================
   VOIR LES PROCURATIONS D'UNE ASSEMBLÉE
   ============================================================ */

async function viewAdminProcurations(assemblyId){

  openAdminPopup(
    '📋 Liste des procurations',
    `
      <div id="adminProxyDetails">
        Chargement des procurations...
      </div>
    `
  );

  try{

    const {data:procurations,error} = await db
      .from('procurations')
      .select('id,grantor_member_id,receiver_member_id,created_at')
      .eq('assembly_id',assemblyId)
      .order('created_at');

    if(error) throw error;

    const {data:membersList,error:membersError} = await db
      .from('members')
      .select('id,first_name,last_name')
      .order('last_name');

    if(membersError) throw membersError;

    const membersMap = {};

    (membersList || []).forEach(m => {
      membersMap[String(m.id)] =
        (m.first_name || '') + ' ' + (m.last_name || '');
    });

    const details = document.getElementById(
      'adminProxyDetails'
    );

    if(!procurations || procurations.length === 0){

      details.innerHTML = `
        <p style="color:#64748b;">
          Aucune procuration enregistrée pour cette assemblée.
        </p>
      `;

      return;
    }

    details.innerHTML = `
      <div style="margin-bottom:15px;font-weight:800;">
        ${procurations.length} procuration(s) enregistrée(s)
      </div>

      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">

          <thead>
            <tr style="background:#f1f5f9;text-align:left;">
              <th style="padding:10px;">Membre</th>
              <th style="padding:10px;">Mandataire</th>
            </tr>
          </thead>

          <tbody>
            ${procurations.map(p => `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:10px;">
                  ${esc(membersMap[String(p.grantor_member_id)] || 'Membre inconnu')}
                </td>
                <td style="padding:10px;">
                  ${esc(membersMap[String(p.receiver_member_id)] || 'Membre inconnu')}
                </td>
              </tr>
            `).join('')}
          </tbody>

        </table>
      </div>
    `;

  }catch(error){

    console.error(error);

    const details = document.getElementById(
      'adminProxyDetails'
    );

    if(details){
      details.innerHTML = `
        <p style="color:#b91c1c;">
          Impossible de charger les procurations :
          ${esc(error.message)}
        </p>
      `;
    }
  }
}


/* ============================================================
   EXPOSER LES FONCTIONS AUX BOUTONS HTML
   ============================================================ */

window.showProcurations = showProcurations;
window.saveMyProcuration = saveMyProcuration;
window.deleteMyProcuration = deleteMyProcuration;
window.openAdminProcurations = openAdminProcurations;
window.createProxyAssembly = createProxyAssembly;
window.loadAdminProcurations = loadAdminProcurations;
window.toggleProxyAssembly = toggleProxyAssembly;
window.viewAdminProcurations = viewAdminProcurations;

/* ============================================================
   MENU ADMINISTRATEUR
   ============================================================ */

function openAdminMenu(){

  const content = `

    <div class="admin-menu-list">

        <!-- PUBLICATIONS -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminPublicationsMenu()"
      >

        <div class="admin-menu-row-icon">
          📢
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Publications
          </div>

          <div class="admin-menu-row-text">
            Publier un message, un document ou une affiche
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>



      <!-- FESTIVITÉS -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminFestivitiesMenu()"
      >

        <div class="admin-menu-row-icon">
          🎉
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Festivités
          </div>

          <div class="admin-menu-row-text">
            Gérer les festivités ou en créer une nouvelle
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- SONDAGES -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminPollsMenu()"
      >

        <div class="admin-menu-row-icon">
          📊
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Sondages
          </div>

          <div class="admin-menu-row-text">
            Gérer les sondages ou en créer un nouveau
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- LISTINGS -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="showListingsAdmin(); closeAdminPopup();"
      >

        <div class="admin-menu-row-icon">
          📋
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Listings
          </div>

          <div class="admin-menu-row-text">
            Gestion et suivi des listings
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- MATÉRIEL -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminMaterialsMenu()"
      >

        <div class="admin-menu-row-icon">
          🧰
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Matériel
          </div>

          <div class="admin-menu-row-text">
            Demandes, prêts et gestion du matériel
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- BOÎTE À IDÉES -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="showAdminIdeasSection()"
      >

        <div class="admin-menu-row-icon">
          💡
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Boîte à idées
          </div>

          <div class="admin-menu-row-text">
            Consulter et traiter les idées
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- DOCUMENTS -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminDocumentsMenu()"
      >

        <div class="admin-menu-row-icon">
          📄
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Documents de travail
          </div>

          <div class="admin-menu-row-text">
            Documents du bureau et futur sondage réservé
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- SUJETS À ABORDER EN RÉUNION -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="closeAdminPopup(); showAdminMeetingSubjects();"
      >

        <div class="admin-menu-row-icon">
          🗣️
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Sujets à aborder en réunion
          </div>

          <div class="admin-menu-row-text">
            Consulter les sujets proposés et suivre leur traitement
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>



      <!-- COMPTES RENDUS -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminReportsMenu()"
      >

        <div class="admin-menu-row-icon">
          📋
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Comptes rendus
          </div>

          <div class="admin-menu-row-text">
            Consulter ou créer un compte rendu
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- TOURNÉES -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="
          manageCalendarTours();
          closeAdminPopup();
        "
      >

        <div class="admin-menu-row-icon">
          🧭
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Gestion des tournées de calendriers
          </div>

          <div class="admin-menu-row-text">
            Communes, secteurs, référents et affectations
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>

<!-- GESTION DES PROCURATIONS -->
<button
  type="button"
  class="admin-menu-row"
  onclick="openAdminProcurations()"
>
  <div class="admin-menu-row-icon">📝</div>

  <div class="admin-menu-row-content">
    <div class="admin-menu-row-title">
      Gestion des procurations
    </div>
    <div class="admin-menu-row-text">
      Publier une assemblée et consulter les procurations reçues
    </div>
  </div>

  <div class="admin-menu-arrow">›</div>
</button>
      <!-- MEMBRES -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="
          showMemberList('all');
          closeAdminPopup();
        "
      >

        <div class="admin-menu-row-icon">
          👥
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Gestion des membres
          </div>

          <div class="admin-menu-row-text">
            Ajouter, modifier et gérer les membres
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- MÉDAILLES -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="
          medalTracking();
          closeAdminPopup();
        "
      >

        <div class="admin-menu-row-icon">
          🏅
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Médailles
          </div>

          <div class="admin-menu-row-text">
            Gestion des distinctions des membres
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <!-- MAINTENANCE -->

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminMaintenanceMenu()"
      >

        <div class="admin-menu-row-icon">
          ⚙️
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Maintenance du système
          </div>

          <div class="admin-menu-row-text">
            Sauvegarde, restauration, diagnostic et historique
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


    </div>

  `;


  openAdminPopup(
    '☰ Menu administrateur',
    content
  );

}


/* ============================================================
   MENU FESTIVITÉS
   ============================================================ */

function openAdminFestivitiesMenu(){

  const content = `

    <div class="admin-menu-list">

      <button
        type="button"
        class="admin-menu-row"
        onclick="openAdminCurrentFestivities()"
      >

        <div class="admin-menu-row-icon">
          🎉
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Gestion des festivités en cours
          </div>

          <div class="admin-menu-row-text">
            Détails, réponses, modification et suppression
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>


      <button
        type="button"
        class="admin-menu-row"
        onclick="
          newEvent();
          closeAdminPopup();
        "
      >

        <div class="admin-menu-row-icon">
          ➕
        </div>

        <div class="admin-menu-row-content">

          <div class="admin-menu-row-title">
            Créer une festivité
          </div>

          <div class="admin-menu-row-text">
            Créer une nouvelle festivité
          </div>

        </div>

        <div class="admin-menu-arrow">
          ›
        </div>

      </button>

    </div>

  `;


  openAdminPopup(
    '🎉 Festivités',
    content
  );

}


/* ============================================================
   FESTIVITÉS EN COURS
   ============================================================ */

function openAdminCurrentFestivities(){

  const events =
    adminDashboardData.events || [];


  const total =
    adminDashboardData.totalPeople || 0;


  const responseMap =
    adminDashboardData.eventResponseMap || {};


  const html =
    events.length

      ? events.map(e => {

          const answered =
            responseMap[String(e.id)]?.size || 0;

          const percent =
            total
              ? Math.min(
                  100,
                  Math.round(
                    answered / total * 100
                  )
                )
              : 0;


          return `

            <div
              class="admin-modern-item"
              style="margin-bottom:12px;"
            >

              <div class="admin-modern-item-top">

                <div>

                  <div class="admin-modern-item-title">
                    🎉 ${esc(
                      e.title ||
                      'Festivité'
                    )}
                  </div>

                  <div class="admin-modern-item-meta">
                    📅 ${fmtDate(e.event_date)}
                  </div>

                </div>

                <strong>
                  ${percent}%
                </strong>

              </div>


              <div class="admin-progress">

                <div
                  class="admin-progress-bar"
                  style="width:${percent}%"
                ></div>

              </div>


              <div
                class="admin-modern-small"
                style="margin-bottom:12px;"
              >
                ${answered} / ${total}
                membres ont répondu
              </div>


              <div
                style="
                  display:flex;
                  flex-wrap:wrap;
                  gap:8px;
                "
              >

                <button
                  type="button"
                  class="secondary"
                  onclick="showAdminEventDetails('${e.id}')"
                >
                  📋 Détails
                </button>


                <button
                  type="button"
                  class="secondary"
                  onclick="
                    eventRecap('${e.id}');
                    closeAdminPopup();
                  "
                >
                  📊 Réponses
                </button>
<button
  type="button"
  class="secondary"
  onclick="showEventNonResponders('${e.id}');"
>
  👤 Non-répondants
</button>


<button
  type="button"
  class="secondary"
  onclick="toggleEventActive('${e.id}')"
>
  ${e.active === false
    ? '▶️ Réactiver'
    : '⏸️ Désactiver'}
</button>



                <button
                  type="button"
                  class="secondary"
                  onclick="
                    editEvent('${e.id}');
                    closeAdminPopup();
                  "
                >
                  ✏️ Modifier
                </button>


                <button
                  type="button"
                  class="ghost"
                  onclick="
                    deleteEvent('${e.id}');
                    closeAdminPopup();
                  "
                >
                  🗑️ Supprimer
                </button>

              </div>

            </div>

          `;

        }).join('')

      : `

        <div class="admin-empty-small">
          Aucune festivité créée.
        </div>

      `;


  openAdminPopup(
    '🎉 Gestion des festivités',
    html
  );

}


/* ============================================================
   DÉTAILS FESTIVITÉ
   ============================================================ */
/* ============================================================
   📢 MENU ADMINISTRATEUR — PUBLICATIONS
   ============================================================ */

function openAdminPublicationsMenu(){

  openAdminPopup(

    '📢 Publications',

    `

      <div class="admin-menu-list">


        <!-- NOUVELLE PUBLICATION -->

        <button
          type="button"
          class="admin-menu-row"
          onclick="
            openAdminNewPublication();
          "
        >

          <div class="admin-menu-row-icon">
            ➕
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Nouvelle publication
            </div>

            <div class="admin-menu-row-text">
              Publier un message, un document ou une affiche
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <!-- PUBLICATIONS EXISTANTES -->

        <button
          type="button"
          class="admin-menu-row"
          onclick="
            showAdminPublications();
          "
        >

          <div class="admin-menu-row-icon">
            📋
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Publications actuelles
            </div>

            <div class="admin-menu-row-text">
              Consulter et supprimer les publications
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


      </div>

    `

  );

}


window.openAdminPublicationsMenu =
  openAdminPublicationsMenu;

/* ============================================================
   📢 NOUVELLE PUBLICATION
   ============================================================ */

function openAdminNewPublication(){

  openAdminPopup(

    '📢 Nouvelle publication',

    `

      <div>

        <!-- TYPE -->

        <div class="admin-detail-section">

          <strong>
            Type de publication
          </strong>

          <div
            style="
              display:flex;
              flex-direction:column;
              gap:8px;
              margin-top:12px;
            "
          >

            <label
              style="
                display:flex;
                align-items:center;
                gap:10px;
                padding:12px;
                border:1px solid #e5e7eb;
                border-radius:10px;
                cursor:pointer;
              "
            >

              <input
                type="radio"
                name="publicationType"
                value="message"
                checked
                onchange="updatePublicationForm()"
              >

              <span>
                💬 Message
              </span>

            </label>


            <label
              style="
                display:flex;
                align-items:center;
                gap:10px;
                padding:12px;
                border:1px solid #e5e7eb;
                border-radius:10px;
                cursor:pointer;
              "
            >

              <input
                type="radio"
                name="publicationType"
                value="document"
                onchange="updatePublicationForm()"
              >

              <span>
                📄 Document
              </span>

            </label>


            <label
              style="
                display:flex;
                align-items:center;
                gap:10px;
                padding:12px;
                border:1px solid #e5e7eb;
                border-radius:10px;
                cursor:pointer;
              "
            >

              <input
                type="radio"
                name="publicationType"
                value="affiche"
                onchange="updatePublicationForm()"
              >

              <span>
                🖼️ Affiche
              </span>

            </label>

          </div>

        </div>


        <!-- TITRE -->

        <div class="admin-detail-section">

          <strong>
            Titre
          </strong>

          <input
            type="text"
            id="publicationTitle"
            class="input"
            placeholder="Titre de la publication"
            style="
              width:100%;
              margin-top:8px;
            "
          >

        </div>


        <!-- CONTENU -->

        <div class="admin-detail-section">

          <strong>
            Message
          </strong>

          <textarea
            id="publicationContent"
            class="input"
            rows="6"
            placeholder="Écrivez votre message..."
            style="
              width:100%;
              margin-top:8px;
              resize:vertical;
            "
          ></textarea>

        </div>


        <!-- FICHIER -->

        <div
          id="publicationFileContainer"
          class="admin-detail-section"
          style="display:none;"
        >

          <strong id="publicationFileLabel">
            📎 Fichier
          </strong>

          <input
            type="file"
            id="publicationFile"
            style="
              width:100%;
              margin-top:10px;
            "
          >

          <div
            class="muted"
            style="
              margin-top:6px;
              font-size:12px;
            "
          >
            Sélectionnez le document ou l'affiche à publier.
          </div>

        </div>


        <!-- APERÇU -->

        <div
          id="publicationPreview"
          style="
            margin-top:15px;
          "
        ></div>


      </div>

    `,

    `

      <button
        type="button"
        class="secondary"
        onclick="
          openAdminPublicationsMenu();
        "
      >
        ← Retour
      </button>


      <button
        type="button"
        class="primary"
        onclick="
          createPublication();
        "
      >
        📢 Publier
      </button>

    `

  );


  setTimeout(() => {

    updatePublicationForm();

  }, 50);

}


window.openAdminNewPublication =
  openAdminNewPublication;

/* ============================================================
   📢 ADAPTATION DU FORMULAIRE
   ============================================================ */

function updatePublicationForm(){

  const type =
    document.querySelector(
      'input[name="publicationType"]:checked'
    )?.value || 'message';


  const fileContainer =
    document.getElementById(
      'publicationFileContainer'
    );


  const fileInput =
    document.getElementById(
      'publicationFile'
    );


  const fileLabel =
    document.getElementById(
      'publicationFileLabel'
    );


  if(!fileContainer){
    return;
  }


  if(type === 'message'){

    fileContainer.style.display =
      'none';

    if(fileInput){
      fileInput.value = '';
    }

  }else{

    fileContainer.style.display =
      'block';


    if(fileLabel){

      fileLabel.textContent =
        type === 'affiche'
          ? '🖼️ Affiche'
          : '📎 Document';

    }


    if(fileInput){

      fileInput.accept =
        type === 'affiche'
          ? 'image/*'
          : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';

    }

  }

}


window.updatePublicationForm =
  updatePublicationForm;
/* ============================================================
   📢 CRÉER UNE PUBLICATION
   ============================================================ */

async function createPublication(){

  try{

    /* ======================================================
       VÉRIFICATION ADMIN
    ====================================================== */

    if(
      !member ||
      String(member.role || '').toLowerCase() !== 'admin'
    ){

      alert(
        '❌ Accès réservé à l’administrateur.'
      );

      return;

    }


    /* ======================================================
       RÉCUPÉRATION DES CHAMPS
    ====================================================== */

    const type =
      document.querySelector(
        'input[name="publicationType"]:checked'
      )?.value || 'message';


    const title =
      document
        .getElementById('publicationTitle')
        ?.value
        ?.trim() || '';


    const content =
      document
        .getElementById('publicationContent')
        ?.value
        ?.trim() || '';


    const fileInput =
      document.getElementById(
        'publicationFile'
      );


    const file =
      fileInput?.files?.[0] || null;


    /* ======================================================
       VALIDATION
    ====================================================== */

    if(!title){

      alert(
        '⚠️ Veuillez renseigner un titre.'
      );

      return;

    }


    if(type === 'message' && !content){

      alert(
        '⚠️ Veuillez renseigner le message.'
      );

      return;

    }


    if(
      (
        type === 'document' ||
        type === 'affiche'
      ) &&
      !file
    ){

      alert(
        '⚠️ Veuillez sélectionner un fichier.'
      );

      return;

    }


    /* ======================================================
       CONFIRMATION
    ====================================================== */

    const typeLabel =
      type === 'message'
        ? 'message'
        : type === 'document'
          ? 'document'
          : 'affiche';


    const confirmation =
      confirm(

        '📢 Publier cette publication ?\n\n' +

        'Titre : ' +
        title +
        '\n' +

        'Type : ' +
        typeLabel +
        '\n\n' +

        'Elle sera immédiatement visible par les membres.'

      );


    if(!confirmation){

      return;

    }


    /* ======================================================
       DÉSACTIVER LE BOUTON
    ====================================================== */

    const buttons =
      document.querySelectorAll(
        '#adminModal button'
      );


    buttons.forEach(button => {

      if(
        button.textContent.includes(
          'Publier'
        )
      ){

        button.disabled = true;

        button.textContent =
          '⏳ Publication...';

      }

    });


    /* ======================================================
       FICHIER
    ====================================================== */

    let fileUrl = null;
    let fileName = null;


    if(file){

      fileName =
        file.name;


      /*
       * Nom unique pour éviter
       * les collisions dans Storage.
       */

      const extension =
        file.name.includes('.')
          ? file.name
              .split('.')
              .pop()
              .toLowerCase()
          : '';


      const uniqueName =
        `${Date.now()}_${crypto.randomUUID()}${extension ? '.' + extension : ''}`;


      const folder =
        type === 'affiche'
          ? 'affiches'
          : 'documents';


      const filePath =
        `${folder}/${uniqueName}`;


      /* ================================================
         UPLOAD STORAGE
      ================================================ */

      const {
        error: uploadError
      } = await db.storage
        .from('publications')
        .upload(
          filePath,
          file,
          {
            cacheControl:'3600',
            upsert:false
          }
        );


      if(uploadError){

        throw uploadError;

      }


      /* ================================================
         URL PUBLIQUE
      ================================================ */

      const {
        data: publicUrlData
      } = db.storage
        .from('publications')
        .getPublicUrl(
          filePath
        );


      fileUrl =
        publicUrlData?.publicUrl ||
        null;


      if(!fileUrl){

        throw new Error(
          'Impossible de récupérer l’URL du fichier.'
        );

      }

    }


    /* ======================================================
       CRÉATION DE LA PUBLICATION
    ====================================================== */

    const {
      data: publication,
      error: publicationError
    } = await db
      .from('publications')
      .insert({

        title:title,

        content:
          content || null,

        type:type,

        file_url:fileUrl,

        file_name:fileName,

        created_by:
          member.id,

        active:true

      })
      .select()
      .single();


    if(publicationError){

      /*
       * Si la création de la publication échoue
       * alors qu'un fichier a déjà été envoyé,
       * on tente de supprimer le fichier.
       */

      if(file && fileUrl){

        try{

          const publicPrefix =
            db.storage
              .from('publications')
              .getPublicUrl('')
              ?.data
              ?.publicUrl || '';


          if(publicPrefix){

            const filePath =
              fileUrl
                .replace(
                  publicPrefix,
                  ''
                );

            if(filePath){

              await db.storage
                .from('publications')
                .remove([
                  filePath
                ]);

            }

          }

        }catch(cleanupError){

          console.warn(
            'Nettoyage fichier impossible :',
            cleanupError
          );

        }

      }


      throw publicationError;

    }
/* ======================================================
   🔔 NOTIFICATION PUSH — NOUVELLE PUBLICATION
====================================================== */

try{

  const { data: pushData, error: pushError } =
    await db.functions.invoke('send-push', {

      body: {

        all_members: true,

        title:
          type === 'affiche'
            ? '🖼️ Nouvelle affiche'
            : type === 'document'
              ? '📄 Nouveau document'
              : '📢 Nouvelle publication',

        message:
          `Une nouvelle publication est disponible : ${title}`

      }

    });


  if(pushError){

    console.error(
      '❌ ERREUR PUSH PUBLICATION :',
      pushError
    );

  }else{

    console.log(
      '✅ PUSH PUBLICATION ENVOYÉ :',
      pushData
    );

  }

}catch(pushError){

  /*
   * Une erreur de notification ne doit
   * jamais empêcher la création de la publication.
   */

  console.error(
    '❌ ERREUR PUSH PUBLICATION :',
    pushError
  );

}

    /* ======================================================
       HISTORIQUE
    ====================================================== */

    try{

      if(
        typeof addSystemHistory ===
        'function'
      ){

        await addSystemHistory({

          category:'publications',

          action:'Nouvelle publication',

          description:
            `Publication créée : ${title}`,

          severity:'success',

          metadata:{

            publication_id:
              publication.id,

            publication_type:
              type,

            title:title

          }

        });

      }

    }catch(historyError){

      console.warn(
        'Historique publication non enregistré :',
        historyError
      );

    }


    /* ======================================================
       SUCCÈS
    ====================================================== */

    alert(
      '✅ Publication créée avec succès.'
    );


    /* ======================================================
       RETOUR AUX PUBLICATIONS
    ====================================================== */

    showAdminPublications();


  }catch(error){

    console.error(
      'ERREUR CRÉATION PUBLICATION :',
      error
    );


    alert(
      '❌ Impossible de créer la publication.\n\n' +
      (
        error?.message ||
        'Erreur inconnue.'
      )
    );


    /*
     * On réactive le bouton
     */

    const buttons =
      document.querySelectorAll(
        '#adminModal button'
      );


    buttons.forEach(button => {

      if(
        button.textContent.includes(
          'Publication'
        ) ||
        button.textContent.includes(
          'Publier'
        )
      ){

        button.disabled = false;

        button.textContent =
          '📢 Publier';

      }

    });

  }

}


window.createPublication =
  createPublication;

/* ============================================================
   📢 AFFICHER LES PUBLICATIONS ADMIN
   ============================================================ */

async function showAdminPublications(){

  try{

    if(
      !member ||
      String(member.role || '').toLowerCase() !== 'admin'
    ){

      alert(
        '❌ Accès réservé à l’administrateur.'
      );

      return;

    }


    const {
      data: publications,
      error
    } = await db
      .from('publications')
      .select('*')
      .order('created_at', {
        ascending:false
      });


    if(error){

      throw error;

    }


    const html = `

      <div>

        ${
          publications?.length

            ? publications.map(publication => {

                const type =
                  publication.type ||
                  'message';


                const icon =
                  type === 'affiche'
                    ? '🖼️'
                    : type === 'document'
                      ? '📄'
                      : '💬';


                const typeLabel =
                  type === 'affiche'
                    ? 'Affiche'
                    : type === 'document'
                      ? 'Document'
                      : 'Message';


                const date =
                  publication.created_at
                    ? new Date(
                        publication.created_at
                      ).toLocaleString(
                        'fr-FR'
                      )
                    : '';


                return `

                  <div
                    class="card"
                    style="
                      margin-bottom:12px;
                      padding:16px;
                    "
                  >

                    <div
                      style="
                        display:flex;
                        align-items:flex-start;
                        gap:10px;
                      "
                    >

                      <div
                        style="
                          font-size:24px;
                        "
                      >
                        ${icon}
                      </div>


                      <div
                        style="
                          flex:1;
                          min-width:0;
                        "
                      >

                        <div
                          style="
                            font-weight:700;
                            font-size:16px;
                          "
                        >

                          ${esc(
                            publication.title ||
                            'Publication sans titre'
                          )}

                        </div>


                        <div
                          class="muted"
                          style="
                            margin-top:4px;
                            font-size:12px;
                          "
                        >

                          ${esc(typeLabel)}
                          •
                          ${esc(date)}

                        </div>

                      </div>

                    </div>


              ${
  publication.content

    ? `

      <div
        style="
          margin-top:12px;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
          word-break:break-word;
          max-width:100%;
          box-sizing:border-box;
        "
      >

        ${esc(
          publication.content
        )}

      </div>

    `

    : ''

}


                    ${
                      publication.file_url

                        ? `

                          <div
                            style="
                              margin-top:12px;
                            "
                          >

                            <a
                              href="${esc(
                                publication.file_url
                              )}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="secondary"
                              style="
                                display:inline-block;
                                text-decoration:none;
                              "
                            >

                              ${
                                type === 'affiche'
                                  ? '🖼️ Voir l’affiche'
                                  : '📄 Ouvrir le document'
                              }

                            </a>

                          </div>

                        `

                        : ''

                    }


                    <div
                      style="
                        display:flex;
                        justify-content:flex-end;
                        margin-top:14px;
                      "
                    >

                      <button
                        type="button"
                        class="ghost"
                        onclick="
                          deletePublication(
                            '${publication.id}'
                          );
                        "
                      >

                        🗑️ Supprimer

                      </button>

                    </div>

                  </div>

                `;

              }).join('')

            : `

              <div
                class="admin-empty-small"
              >

                📭 Aucune publication actuellement.

              </div>

            `

        }

      </div>

    `;


    openAdminPopup(
      '📢 Publications actuelles',
      html
    );


  }catch(error){

    console.error(
      'ERREUR AFFICHAGE PUBLICATIONS :',
      error
    );


    alert(
      '❌ Impossible de charger les publications.\n\n' +
      (
        error?.message ||
        'Erreur inconnue.'
      )
    );

  }

}


window.showAdminPublications =
  showAdminPublications;

/* ============================================================
   🗑️ SUPPRIMER UNE PUBLICATION
   ============================================================ */

async function deletePublication(publicationId){

  try{

    if(
      !member ||
      String(member.role || '').toLowerCase() !== 'admin'
    ){

      alert(
        '❌ Accès réservé à l’administrateur.'
      );

      return;

    }


    /* ======================================================
       RÉCUPÉRER LA PUBLICATION
    ====================================================== */

    const {
      data: publication,
      error: publicationError
    } = await db
      .from('publications')
      .select('*')
      .eq('id', publicationId)
      .single();


    if(publicationError){

      throw publicationError;

    }


    if(!publication){

      alert(
        '❌ Publication introuvable.'
      );

      return;

    }


    /* ======================================================
       CONFIRMATION
    ====================================================== */

    const confirmed =
      confirm(

        '🗑️ Supprimer cette publication ?\n\n' +

        (
          publication.title ||
          'Publication sans titre'
        ) +

        '\n\n' +

        'Elle disparaîtra également de l’espace des membres.'

      );


    if(!confirmed){

      return;

    }


    /* ======================================================
       SUPPRESSION DU FICHIER STORAGE
       ====================================================== */

    if(publication.file_url){

      try{

        const marker =
          '/storage/v1/object/public/publications/';


        const markerIndex =
          publication.file_url.indexOf(
            marker
          );


        if(markerIndex !== -1){

          const filePath =
            decodeURIComponent(
              publication.file_url.substring(
                markerIndex + marker.length
              )
            );


          if(filePath){

            const {
              error: storageError
            } = await db.storage
              .from('publications')
              .remove([
                filePath
              ]);


            if(storageError){

              console.warn(
                'Impossible de supprimer le fichier Storage :',
                storageError
              );

            }

          }

        }

      }catch(storageError){

        console.warn(
          'Erreur suppression fichier :',
          storageError
        );

      }

    }


    /* ======================================================
       SUPPRESSION DE LA PUBLICATION
       ====================================================== */

    const {
      error: deleteError
    } = await db
      .from('publications')
      .delete()
      .eq('id', publicationId);


    if(deleteError){

      throw deleteError;

    }


    /* ======================================================
       HISTORIQUE
       ====================================================== */

    try{

      if(
        typeof addSystemHistory ===
        'function'
      ){

        await addSystemHistory({

          category:'publications',

          action:'Suppression publication',

          description:
            `Publication supprimée : ${
              publication.title ||
              'Sans titre'
            }`,

          severity:'warning',

          metadata:{

            publication_id:
              publication.id,

            publication_type:
              publication.type,

            title:
              publication.title

          }

        });

      }

    }catch(historyError){

      console.warn(
        'Historique suppression publication non enregistré :',
        historyError
      );

    }


    /* ======================================================
       CONFIRMATION
       ====================================================== */

    alert(
      '✅ Publication supprimée.'
    );


    /* ======================================================
       ACTUALISER LA LISTE
       ====================================================== */

    showAdminPublications();


  }catch(error){

    console.error(
      'ERREUR SUPPRESSION PUBLICATION :',
      error
    );


    alert(
      '❌ Impossible de supprimer la publication.\n\n' +
      (
        error?.message ||
        'Erreur inconnue.'
      )
    );

  }

}


window.deletePublication =
  deletePublication;






function showAdminEventDetails(eventId){

  const events =
    adminDashboardData.events || [];


  const event =
    events.find(
      e =>
        String(e.id) ===
        String(eventId)
    );


  if(!event){

    alert(
      'Impossible de retrouver cette festivité.'
    );

    return;

  }


  /* ======================================================
     STATISTIQUES
     ====================================================== */

  const total =
    adminDashboardData.totalPeople || 0;


  const responseMap =
    adminDashboardData.eventResponseMap || {};


  const answered =
    responseMap[String(event.id)]?.size || 0;


  const unanswered =
    Math.max(
      0,
      total - answered
    );


  const percent =
    total
      ? Math.min(
          100,
          Math.round(
            answered /
            total *
            100
          )
        )
      : 0;


  /* ======================================================
     INFORMATIONS UTILES
     ====================================================== */

  const lieu =
    event.location ||
    event.place ||
    event.address ||
    event.lieu ||
    'Non renseigné';


  const heure =
    event.event_time ||
    event.time ||
    event.start_time ||
    '';


  const responseDeadline =
    event.response_deadline ||
    null;


  /* ======================================================
     CONJOINTS / ENFANTS / CADEAU
     ====================================================== */

  const spousesInvited =
    event.spouses_invited;


  const childrenInvited =
    event.children_invited;


  const giftEnabled =
    event.gift_enabled;


  /* ======================================================
     AFFICHAGE
     ====================================================== */

  openAdminPopup(

    `🎉 ${esc(
      event.title ||
      'Détails de la festivité'
    )}`,

    `

      <div>

        <!-- ============================================
             STATISTIQUES
        ============================================= -->

        <div class="admin-detail-stat">

          <div class="admin-detail-stat-box">

            <div class="admin-detail-stat-number">
              ${answered}
            </div>

            <div class="admin-detail-stat-label">
              Réponses
            </div>

          </div>


          <div class="admin-detail-stat-box">

            <div class="admin-detail-stat-number">
              ${unanswered}
            </div>

            <div class="admin-detail-stat-label">
              Non-répondants
            </div>

          </div>


          <div class="admin-detail-stat-box">

            <div class="admin-detail-stat-number">
              ${percent}%
            </div>

            <div class="admin-detail-stat-label">
              Participation
            </div>

          </div>

        </div>


        <!-- ============================================
             DATE / HEURE / LIEU
        ============================================= -->

        <div class="admin-detail-section">

          <strong>
            📅 Date
          </strong>

          <p class="muted">
            ${fmtDate(event.event_date)}
          </p>

        </div>


        ${
          heure
            ? `

              <div class="admin-detail-section">

                <strong>
                  🕐 Heure
                </strong>

                <p class="muted">
                  ${esc(String(heure))}
                </p>

              </div>

            `
            : ''
        }


        <div class="admin-detail-section">

          <strong>
            📍 Lieu
          </strong>

          <p class="muted">
            ${esc(String(lieu))}
          </p>

        </div>


        <!-- ============================================
             DATE LIMITE
        ============================================= -->

        ${
          responseDeadline
            ? `

              <div class="admin-detail-section">

                <strong>
                  ⏰ Date limite de réponse
                </strong>

                <p class="muted">
                  ${esc(
                    new Date(
                      responseDeadline
                    ).toLocaleString(
                      'fr-FR',
                      {
                        dateStyle:'short',
                        timeStyle:'short'
                      }
                    )
                  )}
                </p>

              </div>

            `
            : ''
        }


        <!-- ============================================
             INVITÉS / OPTIONS
        ============================================= -->

        ${
          (
            spousesInvited !== undefined ||
            childrenInvited !== undefined ||
            giftEnabled !== undefined
          )

          ? `

            <div class="admin-detail-section">

              <strong>
                ℹ️ Informations
              </strong>


              ${
                spousesInvited !== undefined
                  ? `

                    <div
                      style="
                        padding:10px 0;
                        border-bottom:1px solid #e5e7eb;
                      "
                    >

                      👩‍❤️‍👨
                      <strong>
                        Conjoints invités :
                      </strong>

                      ${
                        spousesInvited
                          ? '✅ Oui'
                          : '❌ Non'
                      }

                    </div>

                  `
                  : ''
              }


              ${
                childrenInvited !== undefined
                  ? `

                    <div
                      style="
                        padding:10px 0;
                        border-bottom:1px solid #e5e7eb;
                      "
                    >

                      👶
                      <strong>
                        Enfants invités :
                      </strong>

                      ${
                        childrenInvited
                          ? '✅ Oui'
                          : '❌ Non'
                      }

                    </div>

                  `
                  : ''
              }


              ${
                giftEnabled !== undefined
                  ? `

                    <div
                      style="
                        padding:10px 0;
                      "
                    >

                      🎁
                      <strong>
                        Cadeau prévu :
                      </strong>

                      ${
                        giftEnabled
                          ? '✅ Oui'
                          : '❌ Non'
                      }

                    </div>

                  `
                  : ''
              }

            </div>

          `
          : ''
        }


      </div>

    `,

    `

      <button
        type="button"
        class="secondary"
        onclick="
          eventRecap('${event.id}');
          closeAdminPopup();
        "
      >
        📊 Voir les réponses
      </button>


      ${
        unanswered > 0

          ? `

            <button
              type="button"
              class="secondary"
              onclick="
                closeAdminPopup();

                if(
                  confirm(
                    '🔔 Relancer les non-répondants ?\\n\\n' +
                    '${unanswered} membre${unanswered > 1 ? 's' : ''} ' +
                    'n\\'${unanswered > 1 ? 'ont' : 'a'} pas encore répondu.\\n\\n' +
                    'Une notification leur sera envoyée.\\n\\n' +
                    'Continuer ?'
                  )
                ){
                  remindEventNonResponders('${event.id}');
                }
              "
            >
              🔔 Relancer
            </button>

          `

          : ''

      }


      <button
        type="button"
        class="secondary"
        onclick="
          editEvent('${event.id}');
          closeAdminPopup();
        "
      >
        ✏️ Modifier
      </button>


      <button
        type="button"
        class="secondary"
        onclick="
          closeAdminPopup();
        "
      >
        ✕ Fermer
      </button>

    `

  );

}
/* ============================================================
   MENU SONDAGES
   ============================================================ */

function openAdminPollsMenu(){

  openAdminPopup(

    '📊 Sondages',

    `

      <div class="admin-menu-list">

        <button
          type="button"
          class="admin-menu-row"
          onclick="openAdminCurrentPolls()"
        >

          <div class="admin-menu-row-icon">
            📊
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Gestion des sondages en cours
            </div>

            <div class="admin-menu-row-text">
              Résultats, modification et suppression
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            newPoll();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            ➕
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Créer un sondage
            </div>

            <div class="admin-menu-row-text">
              Créer un nouveau sondage
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>

      </div>

    `

  );

}


/* ============================================================
   SONDAGES EN COURS
   ============================================================ */

function openAdminCurrentPolls(){

  const polls =
    adminDashboardData.polls || [];


  const total =
    adminDashboardData.totalPeople || 0;


  const responseMap =
    adminDashboardData.pollResponseMap || {};


  const html =
    polls.length

      ? polls.map(p => {

          const answered =
            responseMap[String(p.id)]?.size || 0;


          const percent =
            total
              ? Math.min(
                  100,
                  Math.round(
                    answered / total * 100
                  )
                )
              : 0;


          return `

            <div
              class="admin-modern-item"
              style="margin-bottom:12px;"
            >

              <div class="admin-modern-item-top">

                <div>

                  <div class="admin-modern-item-title">
                    📊 ${esc(
                      p.question ||
                      p.title ||
                      'Sondage'
                    )}
                  </div>

                </div>

                <strong>
                  ${percent}%
                </strong>

              </div>


              <div class="admin-progress">

                <div
                  class="admin-progress-bar blue"
                  style="width:${percent}%"
                ></div>

              </div>


              <div
                class="admin-modern-small"
                style="margin-bottom:12px;"
              >
                ${answered} / ${total}
                membres ont répondu
              </div>


              <div
                style="
                  display:flex;
                  flex-wrap:wrap;
                  gap:8px;
                "
              >

                <button
                  type="button"
                  class="secondary"
                  onclick="
                    pollRecap('${p.id}');
                    closeAdminPopup();
                  "
                >
                  📋 Résultats
                </button>


<button
  type="button"
  class="secondary"
  onclick="togglePollActive('${p.id}')"
>
  ${p.active === false
    ? '▶️ Réactiver'
    : '⏸️ Désactiver'}
</button>



                <button
                  type="button"
                  class="secondary"
                  onclick="
                    editPoll('${p.id}');
                    closeAdminPopup();
                  "
                >
                  ✏️ Modifier
                </button>


                <button
                  type="button"
                  class="ghost"
                  onclick="
                    deletePoll('${p.id}');
                    closeAdminPopup();
                  "
                >
                  🗑️ Supprimer
                </button>

              </div>

            </div>

          `;

        }).join('')

      : `

        <div class="admin-empty-small">
          Aucun sondage créé.
        </div>

      `;


  openAdminPopup(
    '📊 Gestion des sondages',
    html
  );

}


/* ============================================================
   MENU MATÉRIEL
   ============================================================ */

function openAdminMaterialsMenu(){

  openAdminPopup(

    '🧰 Matériel',

    `

      <div class="admin-menu-list">


        <button
          type="button"
          class="admin-menu-row"
          onclick="showAdminMaterialRequests()"
        >

          <div class="admin-menu-row-icon">
            📥
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Demandes en cours
            </div>

            <div class="admin-menu-row-text">
              Consulter et gérer les demandes de matériel
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            showMaterialCalendar();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            📅
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Calendrier des prêts
            </div>

            <div class="admin-menu-row-text">
              Visualiser les prêts de matériel
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            showMaterialSheet();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            📋
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Gestion du matériel
            </div>

            <div class="admin-menu-row-text">
              Fiche et inventaire du matériel
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            newMaterial();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            ➕
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Ajouter un matériel
            </div>

            <div class="admin-menu-row-text">
              Ajouter un nouvel équipement
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


      </div>

    `

  );

}


/* ============================================================
   DEMANDES MATÉRIEL
   ============================================================ */

function showAdminMaterialRequests(){

  closeAdminPopup();


  const requests =
    adminDashboardData.requests || [];


  /* =====================================================
     📅 FILTRER LES DEMANDES
     
     On conserve :
     - aujourd'hui
     - les dates futures

     On retire uniquement de cette vue :
     - les dates passées

     ⚠️ Aucune suppression en base.
     ===================================================== */

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );


  const activeRequests =
    requests.filter(r => {

      if(!r.start_date){

        /*
         * Si une demande n'a pas de date,
         * on la conserve pour éviter de la
         * faire disparaître accidentellement.
         */

        return true;

      }


      const startDate =
        new Date(r.start_date);


      if(
        Number.isNaN(
          startDate.getTime()
        )
      ){

        return true;

      }


      startDate.setHours(
        0,
        0,
        0,
        0
      );


      return startDate >= today;

    });


  /* =====================================================
     📥 AFFICHAGE
     ===================================================== */

  if(
    typeof renderMaterialRequests ===
    'function'
  ){

    openAdminPopup(

      '🧰 Demandes de matériel',

      renderMaterialRequests(
        activeRequests
      )

    );

    return;

  }


  /* =====================================================
     📋 AFFICHAGE DE SECOURS
     ===================================================== */

  const html =
    activeRequests.length

      ? activeRequests.map(r => {

          const membre =
            r.members || {};


          const nomMembre =
            `${
              membre.first_name || ''
            } ${
              membre.last_name || ''
            }`.trim() ||
            'Membre inconnu';


          return `

            <div
              class="admin-modern-item"
            >

              <div
                class="admin-modern-item-title"
              >

                🧰
                ${
                  esc(
                    r.reason ||
                    'Demande de matériel'
                  )
                }

              </div>


              <div
                class="admin-modern-item-meta"
              >

                ${esc(nomMembre)}

              </div>


              <div
                class="admin-modern-item-meta"
              >

                📅 Début :
                ${fmtDate(r.start_date)}

              </div>


              <div
                class="admin-modern-item-meta"
              >

                📅 Retour :
                ${fmtDate(r.return_date)}

              </div>


              <div
                class="admin-modern-item-meta"
              >

                Statut :
                ${
                  esc(
                    r.status ||
                    'inconnu'
                  )
                }

              </div>

            </div>

          `;

        }).join('')

      : `

        <div
          class="admin-empty-small"
        >

          Aucune demande de matériel en cours.

        </div>

      `;


  openAdminPopup(
    '🧰 Demandes de matériel',
    html
  );

}
/* ============================================================
   DOCUMENTS DE TRAVAIL
   ============================================================ */

function openAdminDocumentsMenu(){

  openAdminPopup(

    '📄 Documents de travail',

    `

      <div class="admin-menu-list">


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            showAdminWorkDocuments();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            📄
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Documents de travail du bureau
            </div>

            <div class="admin-menu-row-text">
              Consulter et gérer les documents
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <!-- EMPLACEMENT FUTUR -->

        <button
          type="button"
          class="admin-menu-row"
         onclick="showBureauPolls()"
        >

          <div class="admin-menu-row-icon">
            📝
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Sondage réservé au bureau
            </div>

            <div class="admin-menu-row-text">
              Créer plusieurs questions et plusieurs réponses
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


      </div>

    `

  );

}


/* ============================================================
   📊 SONDAGES RÉSERVÉS AU BUREAU
   SYSTÈME INDÉPENDANT DES SONDAGES CLASSIQUES
   ============================================================ */


/* ============================================================
   🔐 VÉRIFICATION ACCÈS BUREAU
   ============================================================ */

function canAccessBureauPolls(){

  if(!member){

    return false;

  }


  return (
    member.role === 'admin' ||
    member.bureau_member === true
  );

}


/* ============================================================
   📊 LISTE DES SONDAGES DU BUREAU
   ============================================================ */

async function showBureauPolls(){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Cette section est réservée aux membres du bureau.'
    );

    return;

  }


  try{

    const { data: polls, error } =

      await db

        .from('bureau_polls')

        .select('*')

        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(error){

      console.error(
        'ERREUR CHARGEMENT SONDAGES BUREAU :',
        error
      );

      alert(
        '❌ Impossible de charger les sondages du bureau.\n\n' +
        error.message
      );

      return;

    }


    const list =
      polls || [];


    const html = `

      <div class="admin-menu-list">


        <!-- ==========================================
             BOUTON CRÉER
        =========================================== -->

        <button
          type="button"
          class="admin-menu-row"
          onclick="
            openCreateBureauPoll();
          "
        >

          <div class="admin-menu-row-icon">
            ➕
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Créer un sondage
            </div>

            <div class="admin-menu-row-text">
              Ajouter des questions et des réponses
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        ${
          list.length

          ? list.map(p => `

              <div
                class="admin-modern-item"
                style="
                  margin-top:12px;
                  cursor:default;
                "
              >

                <div
                  class="admin-modern-item-top"
                >

                  <div>

                    <div
                      class="admin-modern-item-title"
                    >
                      📊 ${esc(
                        p.title ||
                        'Sondage sans titre'
                      )}
                    </div>


                    ${
                      p.description

                      ? `

                        <div
                          class="admin-modern-item-meta"
                        >
                          ${esc(
                            p.description
                          )}
                        </div>

                      `

                      : ''

                    }

                  </div>


                  <div
                    class="admin-modern-percent"
                    style="
                      font-size:12px;
                    "
                  >

                    ${
                      p.active
                        ? '🟢 Actif'
                        : '⚪ Fermé'
                    }

                  </div>

                </div>


                <div
                  style="
                    display:flex;
                    flex-wrap:wrap;
                    gap:8px;
                    margin-top:12px;
                  "
                >

                  <button
                    type="button"
                    class="secondary"
                    onclick="
                      openBureauPoll('${p.id}');
                    "
                  >
                    👁️ Ouvrir
                  </button>


                  <button
                    type="button"
                    class="secondary"
                    onclick="
                      editBureauPoll('${p.id}');
                    "
                  >
                    ✏️ Modifier
                  </button>

<button
  type="button"
  class="secondary"
  onclick="
    showBureauPollResults('${p.id}');
  "
>
  📊 Résultats
</button>

                  <button
                    type="button"
                    class="ghost"
                    onclick="
                      toggleBureauPoll('${p.id}', ${p.active});
                    "
                  >

                    ${
                      p.active
                        ? '⏸️ Fermer'
                        : '▶️ Réouvrir'
                    }

                  </button>


                  <button
                    type="button"
                    class="ghost"
                    onclick="
                      deleteBureauPoll('${p.id}');
                    "
                  >
                    🗑️ Supprimer
                  </button>

                </div>

              </div>

            `).join('')

          : `

              <div
                class="admin-empty-small"
                style="
                  margin-top:15px;
                  padding:25px;
                  text-align:center;
                "
              >

                📊 Aucun sondage du bureau.

                <br>

                <span class="muted">
                  Créez votre premier sondage.
                </span>

              </div>

            `
        }


      </div>

    `;


    openAdminPopup(
      '📊 Sondages du bureau',
      html
    );


  }catch(error){

    console.error(
      'ERREUR SONDAGES BUREAU :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


/* ============================================================
   ➕ CRÉATION D'UN SONDAGE
   ============================================================ */

function openCreateBureauPoll(){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé au bureau.'
    );

    return;

  }


  const html = `

    <div
      style="
        display:flex;
        flex-direction:column;
        gap:18px;
      "
    >


      <!-- TITRE -->

      <div>

        <label>

          <strong>
            Titre du sondage
          </strong>

          <input
            id="bureauPollTitle"
            type="text"
            placeholder="Ex : Choix du menu de la Sainte-Barbe"
            style="
              width:100%;
              margin-top:7px;
            "
          >

        </label>

      </div>


      <!-- DESCRIPTION -->

      <div>

        <label>

          <strong>
            Description
          </strong>

          <textarea
            id="bureauPollDescription"
            rows="3"
            placeholder="Description facultative..."
            style="
              width:100%;
              margin-top:7px;
              resize:vertical;
            "
          ></textarea>

        </label>

      </div>


      <!-- QUESTIONS -->

      <div>

        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            margin-bottom:10px;
          "
        >

          <strong>
            Questions
          </strong>

          <button
            type="button"
            class="secondary"
            onclick="
              addBureauPollQuestion();
            "
          >
            ➕ Ajouter une question
          </button>

        </div>


        <div
          id="bureauPollQuestions"
        ></div>

      </div>


      <!-- ACTIONS -->

      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:8px;
          margin-top:5px;
        "
      >

        <button
          type="button"
          class="ghost"
       onclick="
  closeModal();
"
        >
          Annuler
        </button>


        <button
          type="button"
          class="primary"
          onclick="
            saveBureauPoll();
          "
        >
          💾 Enregistrer
        </button>

      </div>

    </div>

  `;


  openAdminPopup(
    '➕ Nouveau sondage du bureau',
    html
  );


  addBureauPollQuestion();

}


/* ============================================================
   ➕ AJOUTER UNE QUESTION
   ============================================================ */

function addBureauPollQuestion(){

  const container =
    document.getElementById(
      'bureauPollQuestions'
    );


  if(!container){

    return;

  }


  const index =
    container
      .querySelectorAll(
        '[data-bureau-question]'
      )
      .length;


  const unique =
    `bureauPoll_${Date.now()}_${index}`;


  const html = `

    <div
      data-bureau-question
      class="card"
      style="
        margin-bottom:14px;
        padding:16px;
        border:1px solid #e5e7eb;
      "
    >


      <!-- EN-TÊTE QUESTION -->

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        "
      >

        <strong>
          Question ${index + 1}
        </strong>


        <button
          type="button"
          class="ghost"
          onclick="
            this
              .closest('[data-bureau-question]')
              ?.remove();
            renumberBureauQuestions();
          "
        >
          🗑️ Supprimer
        </button>

      </div>


      <!-- QUESTION -->

      <input
        type="text"
        data-question-text
        placeholder="Ex : Quel plat préférez-vous ?"
        style="
          width:100%;
          margin-top:12px;
        "
      >


      <!-- TYPE DE CHOIX -->

      <div
        style="
          margin-top:14px;
          padding:14px;
          border-radius:12px;
          background:#f3f6fa;
          border:1px solid #e1e7ef;
        "
      >

        <strong>
          Type de réponse
        </strong>


        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
            margin-top:12px;
            cursor:pointer;
          "
        >

          <input
            type="radio"
            name="${unique}"
            value="single"
            data-choice-type
            checked
          >

          🔘 Un seul choix

        </label>


        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
            margin-top:8px;
            cursor:pointer;
          "
        >

          <input
            type="radio"
            name="${unique}"
            value="multiple"
            data-choice-type
          >

          ☑️ Plusieurs choix

        </label>


        <div
          class="muted"
          style="
            font-size:12px;
            margin-top:8px;
          "
        >

          Avec « plusieurs choix », le membre du bureau
          pourra sélectionner autant de réponses qu'il souhaite.

        </div>

      </div>


      <!-- RÉPONSES -->

      <div
        data-options
        style="
          margin-top:15px;
        "
      ></div>


      <button
        type="button"
        class="secondary"
        onclick="
          addBureauPollOption(this);
        "
        style="
          width:100%;
          margin-top:10px;
        "
      >
        ➕ Ajouter une réponse
      </button>

    </div>

  `;


  container.insertAdjacentHTML(
    'beforeend',
    html
  );


  const question =
    container.lastElementChild;


  const options =
    question.querySelector(
      '[data-options]'
    );


  // Deux réponses par défaut

  addBureauPollOption(
    options
  );

  addBureauPollOption(
    options
  );

}


/* ============================================================
   ➕ AJOUTER UNE RÉPONSE
   ============================================================ */

function addBureauPollOption(target){

  let container = null;


  if(
    target &&
    target.hasAttribute &&
    target.hasAttribute(
      'data-options'
    )
  ){

    container = target;

  }else{

    container =
      target
        ?.closest(
          '[data-bureau-question]'
        )
        ?.querySelector(
          '[data-options]'
        );

  }


  if(!container){

    return;

  }


  const html = `

    <div
      data-bureau-option
      style="
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:8px;
      "
    >

      <input
        type="text"
        data-option-text
        placeholder="Réponse..."
        style="
          flex:1;
        "
      >


      <button
        type="button"
        class="ghost"
        onclick="
          this
            .closest('[data-bureau-option]')
            ?.remove();
        "
        style="
          flex-shrink:0;
        "
      >
        ✕
      </button>

    </div>

  `;


  container.insertAdjacentHTML(
    'beforeend',
    html
  );

}


/* ============================================================
   🔢 RENOMMER LES QUESTIONS
   ============================================================ */

function renumberBureauQuestions(){

  const questions =
    document.querySelectorAll(
      '#bureauPollQuestions [data-bureau-question]'
    );


  questions.forEach(
    (question, index) => {

      const title =
        question.querySelector(
          'strong'
        );


      if(title){

        title.textContent =
          `Question ${index + 1}`;

      }

    }
  );

}


/* ============================================================
   💾 ENREGISTRER LE SONDAGE
   ============================================================ */

async function saveBureauPoll(){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé au bureau.'
    );

    return;

  }


  const title =
    document
      .getElementById(
        'bureauPollTitle'
      )
      ?.value
      ?.trim();


  const description =
    document
      .getElementById(
        'bureauPollDescription'
      )
      ?.value
      ?.trim();


  if(!title){

    alert(
      '⚠️ Veuillez saisir un titre.'
    );

    return;

  }


  const questionElements =
    [
      ...document.querySelectorAll(
        '#bureauPollQuestions [data-bureau-question]'
      )
    ];


  if(!questionElements.length){

    alert(
      '⚠️ Ajoutez au moins une question.'
    );

    return;

  }


  const questions = [];


  for(
    const questionElement
    of questionElements
  ){

    const questionText =
      questionElement
        .querySelector(
          '[data-question-text]'
        )
        ?.value
        ?.trim();


    if(!questionText){

      alert(
        '⚠️ Toutes les questions doivent avoir un texte.'
      );

      return;

    }


    const choiceType =
      questionElement
        .querySelector(
          '[data-choice-type]:checked'
        )
        ?.value ||
      'single';


    const optionElements =
      [
        ...questionElement.querySelectorAll(
          '[data-option-text]'
        )
      ];


    const options = [];


    for(
      const optionElement
      of optionElements
    ){

      const text =
        optionElement
          .value
          .trim();


      if(text){

        options.push(text);

      }

    }


    if(options.length < 2){

      alert(
        `⚠️ La question "${questionText}" doit avoir au moins 2 réponses.`
      );

      return;

    }


    questions.push({

      question:
        questionText,

      choice_type:
        choiceType,

      options

    });

  }


  try{

    /* ======================================================
       1. CRÉER LE SONDAGE
    ====================================================== */

    const {
      data: poll,
      error: pollError
    } =

      await db

        .from('bureau_polls')

        .insert({

          title:
            title,

          description:
            description || null,

          active:
            true,

          created_by:
            member.id

        })

        .select()

        .single();


    if(pollError){

      throw pollError;

    }


    /* ======================================================
       2. CRÉER LES QUESTIONS
    ====================================================== */

    for(
      let i = 0;
      i < questions.length;
      i++
    ){

      const q =
        questions[i];


      const {
        data: question,
        error: questionError
      } =

        await db

          .from(
            'bureau_poll_questions'
          )

          .insert({

            poll_id:
              poll.id,

            question:
              q.question,

            choice_type:
              q.choice_type,

            position:
              i

          })

          .select()

          .single();


      if(questionError){

        throw questionError;

      }


      /* ==================================================
         3. CRÉER LES RÉPONSES
      ================================================== */

      const optionRows =
        q.options.map(
          (
            optionText,
            optionIndex
          ) => ({

            question_id:
              question.id,

            option_text:
              optionText,

            position:
              optionIndex

          })
        );


      const {
        error: optionsError
      } =

        await db

          .from(
            'bureau_poll_options'
          )

          .insert(
            optionRows
          );


      if(optionsError){

        throw optionsError;

      }

    }
/* ======================================================
   🔔 NOTIFICATION — NOUVEAU SONDAGE DU BUREAU
   Destinée uniquement aux membres du bureau
====================================================== */

const {
  error: notificationError
} = await db
  .from('admin_notes')
  .insert({

    title:
      '📝 Nouveau sondage du bureau',

    content:
      `Un nouveau sondage est disponible : "${title}".`,

    active:
      true,

    recipient_type:
      'bureau',

    recipient_member_id:
      null

  });


if(notificationError){

  console.error(
    '⚠️ ERREUR NOTIFICATION SONDAGE BUREAU :',
    notificationError
  );

  /*
    IMPORTANT :
    On ne bloque PAS la création du sondage
    si la notification échoue.
  */

}

 /* ======================================================
   📱 PUSH — NOUVEAU SONDAGE DU BUREAU
====================================================== */

try{

  const {
    data: pushData,
    error: pushError
  } = await db.functions.invoke(
    'send-push',
    {

      body: {

        title:
          '📝 Nouveau sondage du bureau',

        message:
          `Un nouveau sondage est disponible : ${title}`,

        bureau_amicale:
          true

      }

    }
  );


  if(pushError){

    console.error(
      '⚠️ ERREUR PUSH SONDAGE BUREAU :',
      pushError
    );

  }else{

    console.log(
      '✅ PUSH SONDAGE BUREAU ENVOYÉ :',
      pushData
    );

  }

}catch(pushError){

  console.error(
    '⚠️ ERREUR NOTIFICATION PUSH SONDAGE BUREAU :',
    pushError
  );

}

    
    

    closeAdminPopup();


    alert(
      '✅ Sondage du bureau créé avec succès.'
    );


    showBureauPolls();


  }catch(error){

    console.error(
      'ERREUR CRÉATION SONDAGE BUREAU :',
      error
    );


    alert(

      '❌ Impossible de créer le sondage.\n\n' +

      (
        error.message ||
        'Erreur inconnue'
      )

    );

  }

}


/* ============================================================
   👁️ OUVRIR UN SONDAGE
============================================================ */

/* ============================================================
   📊 OUVRIR / VOTER À UN SONDAGE BUREAU
   ============================================================ */

async function openBureauPoll(pollId){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;

  }


  try{

    /* ======================================================
       RÉCUPÉRER LE SONDAGE
    ====================================================== */

    const {
      data: poll,
      error: pollError
    } = await db
      .from('bureau_polls')
      .select('*')
      .eq('id', pollId)
      .single();


    if(pollError)
      throw pollError;


    /* ======================================================
       RÉCUPÉRER LES QUESTIONS + RÉPONSES
    ====================================================== */

    const {
      data: questions,
      error: questionsError
    } = await db
      .from('bureau_poll_questions')
      .select(`
        *,
        bureau_poll_options(*)
      `)
      .eq('poll_id', pollId)
      .order('position', {
        ascending:true
      });


    if(questionsError)
      throw questionsError;


    /* ======================================================
       VÉRIFIER SI LE MEMBRE A DÉJÀ VOTÉ
    ====================================================== */

    const {
      data: existingVotes,
      error: votesError
    } = await db
      .from('bureau_poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('member_id', member.id)
      .limit(1);


    if(votesError)
      throw votesError;


    const alreadyVoted =
      !!(
        existingVotes &&
        existingVotes.length
      );


    /* ======================================================
       CONSTRUCTION DES QUESTIONS
    ====================================================== */

    const questionsHtml =
      (questions || [])
        .map(
          (question, index) => {

            const options =
              question.bureau_poll_options || [];


            return `

              <div
                class="card"
                style="
                  margin-bottom:15px;
                  padding:18px;
                "
              >

                <div
                  style="
                    font-weight:700;
                    font-size:16px;
                  "
                >

                  ${index + 1}.
                  ${esc(question.question)}

                </div>


                <div
                  class="muted"
                  style="
                    margin-top:5px;
                    font-size:12px;
                  "
                >

                  ${
                    question.choice_type === 'multiple'
                      ? '☑️ Plusieurs réponses possibles'
                      : '🔘 Une seule réponse possible'
                  }

                </div>


                <div
                  style="
                    margin-top:14px;
                  "
                >

                  ${
                    options.map(
                      option => `

                        <label
                          style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                            padding:11px 12px;
                            margin-bottom:8px;
                            border:1px solid #e5e7eb;
                            border-radius:10px;
                            cursor:pointer;
                          "
                        >

                          <input
                            type="${
                              question.choice_type === 'multiple'
                                ? 'checkbox'
                                : 'radio'
                            }"

                            name="bureauVote_${question.id}"

                            value="${option.id}"

                            ${
                              alreadyVoted
                                ? 'disabled'
                                : ''
                            }

                          >

                          <span>
                            ${esc(option.option_text)}
                          </span>

                        </label>

                      `
                    ).join('')
                  }

                </div>

              </div>

            `;

          }
        )
        .join('');


    /* ======================================================
       BOUTON VOTE
    ====================================================== */

    const voteButton = alreadyVoted

      ? `

          <div
            style="
              padding:14px;
              border-radius:12px;
              background:#ecfdf5;
              border:1px solid #bbf7d0;
              color:#166534;
              margin-bottom:15px;
            "
          >

            ✅ Vous avez déjà répondu à ce sondage.

          </div>

        `

      : poll.active

        ? `

            <button
              type="button"
              class="primary"
              onclick="
                submitBureauPollVote('${pollId}');
              "
              style="
                width:100%;
              "
            >

              🗳️ Enregistrer mes réponses

            </button>

          `

        : `

            <div
              style="
                padding:14px;
                border-radius:12px;
                background:#f3f4f6;
                color:#4b5563;
              "
            >

              ⚪ Ce sondage est fermé.

            </div>

          `;


    /* ======================================================
       AFFICHAGE
    ====================================================== */

    const html = `

      <div>

        ${
          poll.description
            ? `

                <div
                  class="card"
                  style="
                    margin-bottom:15px;
                  "
                >

                  ${esc(poll.description)}

                </div>

              `
            : ''
        }


        ${
          questionsHtml ||

          `

            <div
              class="admin-empty-small"
            >
              Ce sondage ne contient aucune question.
            </div>

          `
        }


        ${
          questions?.length
            ? voteButton
            : ''
        }


        <div
          style="
            display:flex;
            justify-content:flex-end;
            margin-top:10px;
          "
        >

       <button
  type="button"
  class="ghost"
  onclick="
    closeModal();
  "
>
  Fermer
</button>

        </div>

      </div>

    `;


  openModal(`
  <h2>
    📊 ${esc(poll.title)}
  </h2>

  ${html}
`);


  }catch(error){

    console.error(
      'ERREUR OUVERTURE SONDAGE BUREAU :',
      error
    );


    alert(
      '❌ Impossible d’ouvrir le sondage.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}


/* ============================================================
   🗳️ ENREGISTRER LE VOTE
   ============================================================ */

async function submitBureauPollVote(pollId){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;

  }


  try{

    /* ======================================================
       RÉCUPÉRER LES QUESTIONS
    ====================================================== */

    const {
      data: questions,
      error: questionsError
    } = await db
      .from('bureau_poll_questions')
      .select('*')
      .eq('poll_id', pollId)
      .order('position', {
        ascending:true
      });


    if(questionsError)
      throw questionsError;


    if(!questions?.length){

      alert(
        '⚠️ Ce sondage ne contient aucune question.'
      );

      return;

    }


    const votes = [];


    /* ======================================================
       VÉRIFICATION DE CHAQUE QUESTION
    ====================================================== */

    for(const question of questions){

      const selected =
        [
          ...document.querySelectorAll(
            `input[name="bureauVote_${question.id}"]:checked`
          )
        ];


      /* -----------------------------------------------
         AUCUNE RÉPONSE
      ----------------------------------------------- */

      if(!selected.length){

        alert(
          `⚠️ Veuillez répondre à la question ${question.position + 1}.`
        );

        return;

      }


      /* -----------------------------------------------
         CHOIX UNIQUE
      ----------------------------------------------- */

      if(
        question.choice_type === 'single' &&
        selected.length > 1
      ){

        alert(
          '⚠️ Une seule réponse est autorisée pour cette question.'
        );

        return;

      }


      /* -----------------------------------------------
         AJOUT DES VOTES
      ----------------------------------------------- */

      selected.forEach(
        input => {

          votes.push({

            poll_id:
              pollId,

            question_id:
              question.id,

            option_id:
              input.value,

            member_id:
              member.id

          });

        }
      );

    }


    /* ======================================================
       SÉCURITÉ : VÉRIFIER UNE NOUVELLE FOIS LE DOUBLE VOTE
    ====================================================== */

    const {
      data: existingVotes,
      error: existingError
    } = await db
      .from('bureau_poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('member_id', member.id)
      .limit(1);


    if(existingError)
      throw existingError;


    if(
      existingVotes &&
      existingVotes.length
    ){

      alert(
        '⚠️ Vous avez déjà répondu à ce sondage.'
      );

      await openBureauPoll(pollId);

      return;

    }


    /* ======================================================
       ENREGISTREMENT
    ====================================================== */

    const {
      error: insertError
    } = await db
      .from('bureau_poll_votes')
      .insert(votes);


    if(insertError)
      throw insertError;


    /* ======================================================
       CONFIRMATION
    ====================================================== */

   closeModal();


    alert(
      '✅ Vos réponses ont bien été enregistrées.'
    );


    /* ======================================================
       RÉOUVERTURE DU SONDAGE
    ====================================================== */

    await openBureauPoll(pollId);


  }catch(error){

    console.error(
      'ERREUR ENREGISTREMENT VOTE BUREAU :',
      error
    );


    alert(
      '❌ Impossible d’enregistrer vos réponses.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}



/* ============================================================
   ⏸️ / ▶️ ACTIVER OU FERMER
============================================================ */

async function toggleBureauPoll(
  pollId,
  currentState
){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé au bureau.'
    );

    return;

  }


  const newState =
    !currentState;


  const { error } =

    await db

      .from('bureau_polls')

      .update({

        active:
          newState,

        updated_at:
          new Date().toISOString()

      })

      .eq(
        'id',
        pollId
      );


  if(error){

    console.error(
      error
    );

    alert(
      '❌ Impossible de modifier le statut.'
    );

    return;

  }


  showBureauPolls();

}


/* ============================================================
   🗑️ SUPPRIMER
============================================================ */

async function deleteBureauPoll(
  pollId
){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé au bureau.'
    );

    return;

  }


  if(
    !confirm(
      '⚠️ Supprimer définitivement ce sondage et toutes ses questions ?'
    )
  ){

    return;

  }


  const { error } =

    await db

      .from('bureau_polls')

      .delete()

      .eq(
        'id',
        pollId
      );


  if(error){

    console.error(
      'ERREUR SUPPRESSION :',
      error
    );

    alert(
      '❌ Impossible de supprimer le sondage.'
    );

    return;

  }


  showBureauPolls();

}


/* ============================================================
   ✏️ MODIFICATION
   Pour l'instant : interface préparée
============================================================ */
/* ============================================================
   ✏️ MODIFIER UN SONDAGE BUREAU
   ============================================================ */

async function editBureauPoll(pollId){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;

  }


  try{

    /* ======================================================
       RÉCUPÉRER LE SONDAGE
    ====================================================== */

    const {
      data: poll,
      error: pollError
    } = await db
      .from('bureau_polls')
      .select('*')
      .eq('id', pollId)
      .single();


    if(pollError)
      throw pollError;


    /* ======================================================
       RÉCUPÉRER LES QUESTIONS + RÉPONSES
    ====================================================== */

    const {
      data: questions,
      error: questionsError
    } = await db
      .from('bureau_poll_questions')
      .select(`
        *,
        bureau_poll_options(*)
      `)
      .eq('poll_id', pollId)
      .order('position', {
        ascending:true
      });


    if(questionsError)
      throw questionsError;


    /* ======================================================
       CONSTRUIRE L'INTERFACE
    ====================================================== */

    const questionsHtml =
      (questions || [])
        .map(
          (question, index) => {

            const options =
              (
                question.bureau_poll_options ||
                []
              )
              .sort(
                (a,b) =>
                  (a.position || 0) -
                  (b.position || 0)
              );


            const radioName =
              `editBureauChoice_${question.id}`;


            return `

              <div
                data-edit-bureau-question
                data-question-id="${question.id}"
                class="card"
                style="
                  margin-bottom:15px;
                  padding:16px;
                "
              >

                <!-- ==================================
                     EN-TÊTE
                =================================== -->

                <div
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:10px;
                  "
                >

                  <strong>
                    Question ${index + 1}
                  </strong>


                  <button
                    type="button"
                    class="ghost"
                    onclick="
                      removeEditBureauQuestion(this);
                    "
                  >

                    🗑️ Supprimer

                  </button>

                </div>


                <!-- ==================================
                     QUESTION
                =================================== -->

                <input
                  type="text"
                  data-edit-question-text
                  value="${esc(
                    question.question || ''
                  )}"
                  placeholder="Question..."
                  style="
                    width:100%;
                    margin-top:12px;
                  "
                >


                <!-- ==================================
                     TYPE DE CHOIX
                =================================== -->

                <div
                  style="
                    margin-top:14px;
                    padding:14px;
                    border-radius:12px;
                    background:#f3f6fa;
                    border:1px solid #e1e7ef;
                  "
                >

                  <strong>
                    Type de réponse
                  </strong>


                  <label
                    style="
                      display:flex;
                      align-items:center;
                      gap:8px;
                      margin-top:12px;
                      cursor:pointer;
                    "
                  >

                    <input
                      type="radio"
                      name="${radioName}"
                      value="single"
                      data-edit-choice-type
                      ${
                        question.choice_type === 'single'
                          ? 'checked'
                          : ''
                      }
                    >

                    🔘 Un seul choix

                  </label>


                  <label
                    style="
                      display:flex;
                      align-items:center;
                      gap:8px;
                      margin-top:8px;
                      cursor:pointer;
                    "
                  >

                    <input
                      type="radio"
                      name="${radioName}"
                      value="multiple"
                      data-edit-choice-type
                      ${
                        question.choice_type === 'multiple'
                          ? 'checked'
                          : ''
                      }
                    >

                    ☑️ Plusieurs choix

                  </label>

                </div>


                <!-- ==================================
                     RÉPONSES
                =================================== -->

                <div
                  data-edit-options
                  style="
                    margin-top:15px;
                  "
                >

                  ${
                    options.map(
                      option => `

                        <div
                          data-edit-option
                          data-option-id="${option.id}"
                          style="
                            display:flex;
                            align-items:center;
                            gap:8px;
                            margin-top:8px;
                          "
                        >

                          <input
                            type="text"
                            data-edit-option-text
                            value="${esc(
                              option.option_text || ''
                            )}"
                            placeholder="Réponse..."
                            style="
                              flex:1;
                            "
                          >


                          <button
                            type="button"
                            class="ghost"
                            onclick="
                              this
                                .closest('[data-edit-option]')
                                ?.remove();
                            "
                          >

                            ✕

                          </button>

                        </div>

                      `
                    ).join('')
                  }

                </div>


                <button
                  type="button"
                  class="secondary"
                  onclick="
                    addEditBureauOption(this);
                  "
                  style="
                    width:100%;
                    margin-top:10px;
                  "
                >

                  ➕ Ajouter une réponse

                </button>

              </div>

            `;

          }
        )
        .join('');


    const html = `

      <div>

        <!-- ==========================================
             INFORMATIONS DU SONDAGE
        =========================================== -->

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:15px;
          "
        >

          <div>

            <label>

              <strong>
                Titre
              </strong>


              <input
                id="editBureauPollTitle"
                type="text"
                value="${esc(
                  poll.title || ''
                )}"
                style="
                  width:100%;
                  margin-top:7px;
                "
              >

            </label>

          </div>


          <div>

            <label>

              <strong>
                Description
              </strong>


              <textarea
                id="editBureauPollDescription"
                rows="3"
                style="
                  width:100%;
                  margin-top:7px;
                  resize:vertical;
                "
              >${esc(
                poll.description || ''
              )}</textarea>

            </label>

          </div>


          <!-- ========================================
               QUESTIONS
          ========================================= -->

          <div>

            <div
              style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:10px;
                margin-bottom:10px;
              "
            >

              <strong>
                Questions
              </strong>


              <button
                type="button"
                class="secondary"
                onclick="
                  addEditBureauQuestion();
                "
              >

                ➕ Ajouter une question

              </button>

            </div>


            <div
              id="editBureauPollQuestions"
            >

              ${questionsHtml}

            </div>

          </div>


          <!-- ========================================
               ACTIONS
          ========================================= -->

          <div
            style="
              display:flex;
              justify-content:flex-end;
              gap:8px;
              margin-top:5px;
            "
          >

            <button
              type="button"
              class="ghost"
              onclick="
                closeAdminPopup();
              "
            >

              Annuler

            </button>


            <button
              type="button"
              class="primary"
              onclick="
                saveEditedBureauPoll('${pollId}');
              "
            >

              💾 Enregistrer les modifications

            </button>

          </div>

        </div>

      </div>

    `;


    openAdminPopup(
      '✏️ Modifier le sondage',
      html
    );


  }catch(error){

    console.error(
      'ERREUR MODIFICATION SONDAGE BUREAU :',
      error
    );


    alert(
      '❌ Impossible de charger le sondage.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}


/* ============================================================
   ➕ AJOUTER UNE QUESTION DANS L'ÉDITEUR
   ============================================================ */

function addEditBureauQuestion(){

  const container =
    document.getElementById(
      'editBureauPollQuestions'
    );


  if(!container)
    return;


  const index =
    container.querySelectorAll(
      '[data-edit-bureau-question]'
    ).length;


  const unique =
    `editBureauNew_${Date.now()}_${index}`;


  const html = `

    <div
      data-edit-bureau-question
      data-question-id=""
      class="card"
      style="
        margin-bottom:15px;
        padding:16px;
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        "
      >

        <strong>
          Question ${index + 1}
        </strong>


        <button
          type="button"
          class="ghost"
          onclick="
            removeEditBureauQuestion(this);
          "
        >

          🗑️ Supprimer

        </button>

      </div>


      <input
        type="text"
        data-edit-question-text
        placeholder="Question..."
        style="
          width:100%;
          margin-top:12px;
        "
      >


      <div
        style="
          margin-top:14px;
          padding:14px;
          border-radius:12px;
          background:#f3f6fa;
          border:1px solid #e1e7ef;
        "
      >

        <strong>
          Type de réponse
        </strong>


        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
            margin-top:12px;
            cursor:pointer;
          "
        >

          <input
            type="radio"
            name="${unique}"
            value="single"
            data-edit-choice-type
            checked
          >

          🔘 Un seul choix

        </label>


        <label
          style="
            display:flex;
            align-items:center;
            gap:8px;
            margin-top:8px;
            cursor:pointer;
          "
        >

          <input
            type="radio"
            name="${unique}"
            value="multiple"
            data-edit-choice-type
          >

          ☑️ Plusieurs choix

        </label>

      </div>


      <div
        data-edit-options
        style="
          margin-top:15px;
        "
      >

      </div>


      <button
        type="button"
        class="secondary"
        onclick="
          addEditBureauOption(this);
        "
        style="
          width:100%;
          margin-top:10px;
        "
      >

        ➕ Ajouter une réponse

      </button>

    </div>

  `;


  container.insertAdjacentHTML(
    'beforeend',
    html
  );


  const question =
    container.lastElementChild;


  const options =
    question.querySelector(
      '[data-edit-options]'
    );


  addEditBureauOption(
    options
  );

  addEditBureauOption(
    options
  );


  renumberEditBureauQuestions();

}


/* ============================================================
   ➕ AJOUTER UNE RÉPONSE
   ============================================================ */

function addEditBureauOption(target){

  let container = null;


  if(
    target &&
    target.hasAttribute &&
    target.hasAttribute(
      'data-edit-options'
    )
  ){

    container = target;

  }else{

    container =
      target
        ?.closest(
          '[data-edit-bureau-question]'
        )
        ?.querySelector(
          '[data-edit-options]'
        );

  }


  if(!container)
    return;


  const html = `

    <div
      data-edit-option
      data-option-id=""
      style="
        display:flex;
        align-items:center;
        gap:8px;
        margin-top:8px;
      "
    >

      <input
        type="text"
        data-edit-option-text
        placeholder="Réponse..."
        style="
          flex:1;
        "
      >


      <button
        type="button"
        class="ghost"
        onclick="
          this
            .closest('[data-edit-option]')
            ?.remove();
        "
      >

        ✕

      </button>

    </div>

  `;


  container.insertAdjacentHTML(
    'beforeend',
    html
  );

}


/* ============================================================
   🗑️ SUPPRIMER UNE QUESTION
   ============================================================ */

function removeEditBureauQuestion(button){

  const question =
    button?.closest(
      '[data-edit-bureau-question]'
    );


  if(!question)
    return;


  question.remove();


  renumberEditBureauQuestions();

}


/* ============================================================
   🔢 RENOMMER LES QUESTIONS
   ============================================================ */

function renumberEditBureauQuestions(){

  const questions =
    document.querySelectorAll(
      '#editBureauPollQuestions [data-edit-bureau-question]'
    );


  questions.forEach(
    (question, index) => {

      const title =
        question.querySelector(
          'strong'
        );


      if(title){

        title.textContent =
          `Question ${index + 1}`;

      }

    }
  );

}


/* ============================================================
   💾 ENREGISTRER LES MODIFICATIONS
   ============================================================ */

async function saveEditedBureauPoll(pollId){

  if(!canAccessBureauPolls()){

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;

  }


  const title =
    document
      .getElementById(
        'editBureauPollTitle'
      )
      ?.value
      ?.trim();


  const description =
    document
      .getElementById(
        'editBureauPollDescription'
      )
      ?.value
      ?.trim();


  if(!title){

    alert(
      '⚠️ Le titre est obligatoire.'
    );

    return;

  }


  const questionElements =
    [
      ...document.querySelectorAll(
        '#editBureauPollQuestions [data-edit-bureau-question]'
      )
    ];


  if(!questionElements.length){

    alert(
      '⚠️ Le sondage doit contenir au moins une question.'
    );

    return;

  }


  /* ======================================================
     PRÉPARER LES DONNÉES AVANT DE MODIFIER SUPABASE
  ====================================================== */

  const questions = [];


  for(
    let i = 0;
    i < questionElements.length;
    i++
  ){

    const element =
      questionElements[i];


    const questionId =
      element.dataset.questionId || null;


    const questionText =
      element
        .querySelector(
          '[data-edit-question-text]'
        )
        ?.value
        ?.trim();


    if(!questionText){

      alert(
        `⚠️ La question ${i + 1} n'a pas de texte.`
      );

      return;

    }


    const choiceType =
      element
        .querySelector(
          '[data-edit-choice-type]:checked'
        )
        ?.value ||
      'single';


    const optionElements =
      [
        ...element.querySelectorAll(
          '[data-edit-option]'
        )
      ];


    const options = [];


    for(
      const optionElement
      of optionElements
    ){

      const optionId =
        optionElement.dataset.optionId ||
        null;


      const optionText =
        optionElement
          .querySelector(
            '[data-edit-option-text]'
          )
          ?.value
          ?.trim();


      if(optionText){

        options.push({

          id:
            optionId,

          text:
            optionText

        });

      }

    }


    if(options.length < 2){

      alert(
        `⚠️ La question ${i + 1} doit avoir au moins 2 réponses.`
      );

      return;

    }


    questions.push({

      id:
        questionId,

      question:
        questionText,

      choice_type:
        choiceType,

      position:
        i,

      options

    });

  }


  try{
    /* ======================================================
       🔒 VÉRIFIER LES VOTES EXISTANTS
    ====================================================== */

    const voteProtection =
      await checkBureauPollVotesBeforeEdit(
        pollId
      );

    
    /* ======================================================
       1. MODIFIER LE SONDAGE
    ====================================================== */

    const {
      error: pollError
    } = await db
      .from('bureau_polls')
      .update({

        title:
          title,

        description:
          description || null,

        updated_at:
          new Date().toISOString()

      })
      .eq(
        'id',
        pollId
      );


    if(pollError)
      throw pollError;


    /* ======================================================
       2. RÉCUPÉRER LES QUESTIONS EXISTANTES
    ====================================================== */

    const {
      data: oldQuestions,
      error: oldQuestionsError
    } = await db
      .from('bureau_poll_questions')
      .select('id')
      .eq(
        'poll_id',
        pollId
      );


    if(oldQuestionsError)
      throw oldQuestionsError;


    const oldQuestionIds =
      (oldQuestions || [])
        .map(
          q => q.id
        );


    const keptQuestionIds =
      questions
        .filter(
          q => q.id
        )
        .map(
          q => q.id
        );


    /* ======================================================
       3. SUPPRIMER LES QUESTIONS RETIRÉES
       
       ATTENTION :
       Le CASCADE supprimera également leurs options
       et leurs votes.
    ====================================================== */

    const deletedQuestionIds =
      oldQuestionIds.filter(
        id =>
          !keptQuestionIds.includes(id)
      );
/* ======================================================
   🔒 NE PAS SUPPRIMER UNE QUESTION AYANT DES VOTES
====================================================== */

const protectedQuestions =
  deletedQuestionIds.filter(
    id =>
      voteProtection.questionVotes.has(id)
  );


if(protectedQuestions.length){

  alert(
    '⚠️ Impossible de supprimer une question ayant déjà reçu des votes.\n\n' +
    'Les résultats déjà enregistrés doivent être conservés.'
  );

  return;

}

    if(deletedQuestionIds.length){

      const {
        error: deleteQuestionsError
      } = await db
        .from('bureau_poll_questions')
        .delete()
        .in(
          'id',
          deletedQuestionIds
        );


      if(deleteQuestionsError)
        throw deleteQuestionsError;

    }


    /* ======================================================
       4. TRAITER CHAQUE QUESTION
    ====================================================== */

    for(
      const question of questions
    ){

      let questionId =
        question.id;


      /* -----------------------------------------------
         NOUVELLE QUESTION
      ------------------------------------------------ */

      if(!questionId){

        const {
          data: createdQuestion,
          error: createQuestionError
        } = await db
          .from(
            'bureau_poll_questions'
          )
          .insert({

            poll_id:
              pollId,

            question:
              question.question,

            choice_type:
              question.choice_type,

            position:
              question.position

          })
          .select()
          .single();


        if(createQuestionError)
          throw createQuestionError;


        questionId =
          createdQuestion.id;

      }


      /* -----------------------------------------------
         QUESTION EXISTANTE
      ------------------------------------------------ */

      else{

        const {
          error: updateQuestionError
        } = await db
          .from(
            'bureau_poll_questions'
          )
          .update({

            question:
              question.question,

            choice_type:
              question.choice_type,

            position:
              question.position

          })
          .eq(
            'id',
            questionId
          );


        if(updateQuestionError)
          throw updateQuestionError;

      }


      /* -----------------------------------------------
         RÉCUPÉRER LES OPTIONS EXISTANTES
      ------------------------------------------------ */

      const {
        data: oldOptions,
        error: oldOptionsError
      } = await db
        .from(
          'bureau_poll_options'
        )
        .select('id')
        .eq(
          'question_id',
          questionId
        );


      if(oldOptionsError)
        throw oldOptionsError;


      const oldOptionIds =
        (oldOptions || [])
          .map(
            o => o.id
          );


      const keptOptionIds =
        question.options
          .filter(
            option => option.id
          )
          .map(
            option => option.id
          );


      const deletedOptionIds =
        oldOptionIds.filter(
          id =>
            !keptOptionIds.includes(id)
        );

/* ======================================================
   🔒 NE PAS SUPPRIMER UNE RÉPONSE AYANT DES VOTES
====================================================== */

const protectedOptions =
  deletedOptionIds.filter(
    id =>
      voteProtection.optionVotes.has(id)
  );


if(protectedOptions.length){

  alert(
    '⚠️ Impossible de supprimer une réponse ayant déjà reçu un vote.\n\n' +
    'Les résultats déjà enregistrés doivent être conservés.'
  );

  return;

}
      /* -----------------------------------------------
         SUPPRIMER LES OPTIONS RETIRÉES
      ------------------------------------------------ */

      if(deletedOptionIds.length){

        const {
          error: deleteOptionsError
        } = await db
          .from(
            'bureau_poll_options'
          )
          .delete()
          .in(
            'id',
            deletedOptionIds
          );


        if(deleteOptionsError)
          throw deleteOptionsError;

      }


      /* -----------------------------------------------
         TRAITER LES OPTIONS
      ------------------------------------------------ */

      for(
        let optionIndex = 0;
        optionIndex < question.options.length;
        optionIndex++
      ){

        const option =
          question.options[
            optionIndex
          ];


        /* NOUVELLE OPTION */

        if(!option.id){

          const {
            error: createOptionError
          } = await db
            .from(
              'bureau_poll_options'
            )
            .insert({

              question_id:
                questionId,

              option_text:
                option.text,

              position:
                optionIndex

            });


          if(createOptionError)
            throw createOptionError;

        }


        /* OPTION EXISTANTE */

        else{

          const {
            error: updateOptionError
          } = await db
            .from(
              'bureau_poll_options'
            )
            .update({

              option_text:
                option.text,

              position:
                optionIndex

            })
            .eq(
              'id',
              option.id
            );


          if(updateOptionError)
            throw updateOptionError;

        }

      }

    }


    /* ======================================================
       FIN
    ====================================================== */

    closeAdminPopup();


    alert(
      '✅ Les modifications ont bien été enregistrées.'
    );


    await showBureauPolls();


  }catch(error){

    console.error(
      'ERREUR MODIFICATION SONDAGE BUREAU :',
      error
    );


    alert(
      '❌ Impossible d’enregistrer les modifications.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}

/* ============================================================
   🔒 VÉRIFIER LES VOTES AVANT MODIFICATION
   ============================================================ */

async function checkBureauPollVotesBeforeEdit(pollId){

  try{

    const {
      data: votes,
      error
    } = await db
      .from('bureau_poll_votes')
      .select(`
        id,
        question_id,
        option_id
      `)
      .eq(
        'poll_id',
        pollId
      );


    if(error)
      throw error;


    const allVotes =
      votes || [];


    const questionVotes =
      new Set(
        allVotes
          .map(
            vote =>
              vote.question_id
          )
      );


    const optionVotes =
      new Set(
        allVotes
          .map(
            vote =>
              vote.option_id
          )
      );


    return {

      hasVotes:
        allVotes.length > 0,

      questionVotes,

      optionVotes,

      totalVotes:
        allVotes.length

    };


  }catch(error){

    console.error(
      'ERREUR VÉRIFICATION VOTES :',
      error
    );


    throw error;

  }

}



/* ======================================================
   📊 AFFICHER LES RÉSULTATS D'UN SONDAGE BUREAU
====================================================== */

async function showBureauPollResults(pollId){

  try{

    /* ======================================================
       SÉCURITÉ
    ====================================================== */

    if(
      typeof canAccessBureauPolls === 'function' &&
      !canAccessBureauPolls()
    ){

      alert(
        '❌ Accès réservé aux membres du bureau.'
      );

      return;

    }


    /* ======================================================
       VÉRIFICATION DE L'ID
    ====================================================== */

    if(!pollId){

      alert(
        '❌ Identifiant du sondage manquant.'
      );

      return;

    }


    /* ======================================================
       SONDAGE
    ====================================================== */

    const {
      data: poll,
      error: pollError
    } = await db
      .from('bureau_polls')
      .select('*')
      .eq('id', pollId)
      .single();


    if(pollError){

      throw pollError;

    }


    if(!poll){

      throw new Error(
        'Sondage introuvable.'
      );

    }


    /* ======================================================
       QUESTIONS + OPTIONS
       IMPORTANT :
       aucune syntaxe avec backtick ici
    ====================================================== */

    const {
      data: questions,
      error: questionsError
    } = await db
      .from('bureau_poll_questions')
      .select('*, bureau_poll_options(*)')
      .eq('poll_id', pollId)
      .order('position', {
        ascending: true
      });


    if(questionsError){

      throw questionsError;

    }


    /* ======================================================
       TOUS LES VOTES
    ====================================================== */

    const {
      data: votes,
      error: votesError
    } = await db
      .from('bureau_poll_votes')
      .select('*')
      .eq('poll_id', pollId);


    if(votesError){

      throw votesError;

    }


    const allVotes =
      votes || [];


    const questionList =
      questions || [];


    /* ======================================================
       PARTICIPANTS UNIQUES
    ====================================================== */

    const participantIds = [
      ...new Set(
        allVotes
          .map(function(vote){

            return vote.member_id;

          })
          .filter(Boolean)
      )
    ];


    const participants =
      participantIds.length;


    /* ======================================================
       RÉCUPÉRATION DES MEMBRES
    ====================================================== */

    let participantsList = [];


    if(participantIds.length > 0){

      const {
        data: members,
        error: membersError
      } = await db
        .from('members')
        .select(
          'id, first_name, last_name'
        )
        .in(
          'id',
          participantIds
        );


      if(membersError){

        throw membersError;

      }


      participantsList =
        members || [];

    }


    /* ======================================================
       FONCTION POUR ÉCHAPPER LE HTML
    ====================================================== */

    function escapeHtml(value){

      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    }


    /* ======================================================
       LISTE DES PARTICIPANTS
    ====================================================== */

    let participantsHtml = '';


    if(participantsList.length > 0){

      participantsList.sort(
        function(a,b){

          const nameA =
            (
              (a.last_name || '') +
              ' ' +
              (a.first_name || '')
            )
              .trim()
              .toLowerCase();


          const nameB =
            (
              (b.last_name || '') +
              ' ' +
              (b.first_name || '')
            )
              .trim()
              .toLowerCase();


          return nameA.localeCompare(
            nameB,
            'fr'
          );

        }
      );


      participantsList.forEach(
        function(member){

          const fullName =
            [
              member.first_name,
              member.last_name
            ]
              .filter(Boolean)
              .join(' ');


          participantsHtml +=
            '<div ' +
              'style="' +
                'display:flex;' +
                'align-items:center;' +
                'gap:10px;' +
                'padding:11px 12px;' +
                'border-bottom:1px solid #e5e7eb;' +
              '"' +
            '>' +

              '<div ' +
                'style="' +
                  'width:34px;' +
                  'height:34px;' +
                  'border-radius:50%;' +
                  'background:#eff6ff;' +
                  'display:flex;' +
                  'align-items:center;' +
                  'justify-content:center;' +
                  'font-size:17px;' +
                  'flex-shrink:0;' +
                '"' +
              '>' +

                '👤' +

              '</div>' +

              '<div ' +
                'style="' +
                  'flex:1;' +
                  'min-width:0;' +
                  'font-weight:600;' +
                  'color:#1e293b;' +
                '"' +
              '>' +

                escapeHtml(
                  fullName ||
                  'Membre inconnu'
                ) +

              '</div>' +

            '</div>';

        }
      );


    }else{

      participantsHtml =
        '<div ' +
          'class="muted" ' +
          'style="' +
            'padding:25px;' +
            'text-align:center;' +
          '"' +
        '>' +

          'Aucun participant pour le moment.' +

        '</div>';

    }


    /* ======================================================
       FONCTION POUR AFFICHER LES PARTICIPANTS
    ====================================================== */

    window.showBureauPollParticipants =
      function(){

        openAdminPopup(

          '👥 Participants au sondage',

          '<div>' +

            '<div ' +
              'style="' +
                'margin-bottom:15px;' +
                'font-weight:600;' +
              '"' +
            '>' +

              participants +

              ' participant' +

              (
                participants > 1
                  ? 's'
                  : ''
              ) +

            '</div>' +


            '<div ' +
              'class="card" ' +
              'style="' +
                'padding:0;' +
                'overflow:hidden;' +
              '"' +
            '>' +

              participantsHtml +

            '</div>' +


            '<div ' +
              'style="' +
                'display:flex;' +
                'justify-content:flex-end;' +
                'margin-top:18px;' +
              '"' +
            '>' +

              '<button ' +
                'type="button" ' +
                'class="ghost" ' +
                'onclick="closeAdminPopup();"' +
              '>' +

                'Fermer' +

              '</button>' +

            '</div>' +

          '</div>'

        );

      };


    /* ======================================================
       CONSTRUCTION DES RÉSULTATS
    ====================================================== */

    let resultsHtml = '';


    if(questionList.length === 0){

      resultsHtml =
        '<div ' +
          'class="muted" ' +
          'style="' +
            'padding:25px;' +
            'text-align:center;' +
          '"' +
        '>' +

          'Aucune question dans ce sondage.' +

        '</div>';


    }else{

      questionList.forEach(
        function(question, questionIndex){

          const options =
            question.bureau_poll_options ||
            [];


          const questionVotes =
            allVotes.filter(
              function(vote){

                return (
                  vote.question_id ===
                  question.id
                );

              }
            );


          const totalQuestionVotes =
            questionVotes.length;


          let optionsHtml = '';


          if(options.length === 0){

            optionsHtml =
              '<div ' +
                'class="muted" ' +
                'style="margin-top:12px;"' +
              '>' +

                'Aucune réponse disponible.' +

              '</div>';


          }else{

            options.forEach(
              function(option){

                const count =
                  questionVotes.filter(
                    function(vote){

                      return (
                        vote.option_id ===
                        option.id
                      );

                    }
                  ).length;


                const percent =
                  totalQuestionVotes > 0

                    ? Math.round(
                        (
                          count /
                          totalQuestionVotes
                        ) * 100
                      )

                    : 0;


                optionsHtml +=

                  '<div ' +
                    'style="' +
                      'margin-top:14px;' +
                    '"' +
                  '>' +

                    '<div ' +
                      'style="' +
                        'display:flex;' +
                        'justify-content:space-between;' +
                        'gap:10px;' +
                        'font-size:14px;' +
                        'margin-bottom:5px;' +
                      '"' +
                    '>' +

                      '<strong>' +

                        escapeHtml(
                          option.option_text ||
                          option.title ||
                          ''
                        ) +

                      '</strong>' +

                      '<span>' +

                        count +

                        ' vote' +

                        (
                          count > 1
                            ? 's'
                            : ''
                        ) +

                        ' · ' +

                        percent +

                        '%' +

                      '</span>' +

                    '</div>' +


                    '<div ' +
                      'style="' +
                        'width:100%;' +
                        'height:10px;' +
                        'background:#e5e7eb;' +
                        'border-radius:999px;' +
                        'overflow:hidden;' +
                      '"' +
                    '>' +

                      '<div ' +
                        'style="' +
                          'width:' +
                          percent +
                          '%;' +
                          'height:100%;' +
                          'background:#2563eb;' +
                          'border-radius:999px;' +
                        '"' +
                      '>' +

                      '</div>' +

                    '</div>' +

                  '</div>';

              }
            );

          }


          const questionText =
            question.question ||
            question.title ||
            question.text ||
            'Question';


          resultsHtml +=

            '<div ' +
              'class="card" ' +
              'style="' +
                'margin-bottom:16px;' +
                'padding:18px;' +
              '"' +
            '>' +

              '<div ' +
                'style="' +
                  'font-size:16px;' +
                  'font-weight:700;' +
                '"' +
              '>' +

                (
                  questionIndex + 1
                ) +

                '. ' +

                escapeHtml(
                  questionText
                ) +

              '</div>' +


              '<div ' +
                'class="muted" ' +
                'style="' +
                  'margin-top:5px;' +
                  'font-size:12px;' +
                '"' +
              '>' +

                totalQuestionVotes +

                ' réponse' +

                (
                  totalQuestionVotes > 1
                    ? 's'
                    : ''
                ) +

              '</div>' +


              optionsHtml +

            '</div>';

        }
      );

    }


    /* ======================================================
       TITRE DU SONDAGE
    ====================================================== */

    const pollTitle =
      poll.title ||
      'Sondage';


    /* ======================================================
       DESCRIPTION
    ====================================================== */

    let descriptionHtml = '';


    if(poll.description){

      descriptionHtml =

        '<div ' +
          'class="muted" ' +
          'style="margin-top:5px;"' +
        '>' +

          escapeHtml(
            poll.description
          ) +

        '</div>';

    }


    /* ======================================================
       HTML PRINCIPAL
    ====================================================== */

    const html =

      '<div>' +


        '<div ' +
          'style="' +
            'display:grid;' +
            'grid-template-columns:repeat(auto-fit,minmax(150px,1fr));' +
            'gap:12px;' +
            'margin-bottom:18px;' +
          '"' +
        '>' +


          /* PARTICIPANTS */

          '<div ' +
            'class="card" ' +
            'style="' +
              'padding:16px;' +
              'text-align:center;' +
              'cursor:pointer;' +
            '"' +
            'onclick="showBureauPollParticipants();"' +
            'title="Voir les participants"' +
          '>' +

            '<div ' +
              'style="' +
                'font-size:26px;' +
                'font-weight:800;' +
              '"' +
            '>' +

              participants +

            '</div>' +

            '<div ' +
              'class="muted" ' +
              'style="text-decoration:underline;"' +
            '>' +

              'participant' +

              (
                participants > 1
                  ? 's'
                  : ''
              ) +

            '</div>' +

            '<div ' +
              'style="' +
                'margin-top:5px;' +
                'font-size:11px;' +
                'opacity:.7;' +
              '"' +
            '>' +

              '👆 Cliquer pour voir les noms' +

            '</div>' +

          '</div>' +


          /* QUESTIONS */

          '<div ' +
            'class="card" ' +
            'style="' +
              'padding:16px;' +
              'text-align:center;' +
            '"' +
          '>' +

            '<div ' +
              'style="' +
                'font-size:26px;' +
                'font-weight:800;' +
              '"' +
            '>' +

              questionList.length +

            '</div>' +

            '<div class="muted">' +

              'question' +

              (
                questionList.length > 1
                  ? 's'
                  : ''
              ) +

            '</div>' +

          '</div>' +


          /* VOTES */

          '<div ' +
            'class="card" ' +
            'style="' +
              'padding:16px;' +
              'text-align:center;' +
            '"' +
          '>' +

            '<div ' +
              'style="' +
                'font-size:26px;' +
                'font-weight:800;' +
              '"' +
            '>' +

              allVotes.length +

            '</div>' +

            '<div class="muted">' +

              'votes enregistrés' +

            '</div>' +

          '</div>' +


        '</div>' +


        /* TITRE */

        '<div ' +
          'style="margin-bottom:18px;"' +
        '>' +

          '<h3 style="margin:0;">' +

            '📊 ' +

            escapeHtml(
              pollTitle
            ) +

          '</h3>' +

          descriptionHtml +

        '</div>' +


        /* RÉSULTATS */

        resultsHtml +


        /* FERMER */

        '<div ' +
          'style="' +
            'display:flex;' +
            'justify-content:flex-end;' +
            'margin-top:18px;' +
          '"' +
        '>' +

          '<button ' +
            'type="button" ' +
            'class="ghost" ' +
            'onclick="closeAdminPopup();"' +
          '>' +

            'Fermer' +

          '</button>' +

        '</div>' +


      '</div>';


    /* ======================================================
       OUVERTURE DE LA POPUP
    ====================================================== */

    openAdminPopup(
      '📊 Résultats du sondage',
      html
    );


  }catch(error){

    console.error(
      'ERREUR RÉSULTATS SONDAGE BUREAU :',
      error
    );


    alert(
      '❌ Impossible de charger les résultats.\n\n' +
      (
        error &&
        error.message
          ? error.message
          : 'Erreur inconnue.'
      )
    );

  }

}


/* ======================================================
   EXPOSITION GLOBALE
====================================================== */

window.showBureauPollResults =
  showBureauPollResults;



/* ============================================================
   COMPTES RENDUS
   ============================================================ */

function openAdminReportsMenu(){

  openAdminPopup(

    '📋 Comptes rendus',

    `

      <div class="admin-menu-list">


        <button
          type="button"
          class="admin-menu-row"
          onclick="showAdminPublishedReports()"
        >

          <div class="admin-menu-row-icon">
            📚
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Comptes rendus publiés
            </div>

            <div class="admin-menu-row-text">
              Consulter les comptes rendus existants
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            addMeetingReport();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            ➕
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Nouveau compte rendu
            </div>

            <div class="admin-menu-row-text">
              Créer un nouveau compte rendu
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


      </div>

    `

  );

}


/* ============================================================
   COMPTES RENDUS PUBLIÉS
   ============================================================ */


async function showAdminPublishedReports(){

  closeAdminPopup();

  openAdminPopup(
    '📚 Comptes rendus publiés',
    `
      <div id="adminMeetingReportsList">
        <p class="muted" style="text-align:center;padding:20px;">
          ⏳ Chargement des comptes rendus...
        </p>
      </div>
    `
  );

  // Charge les comptes rendus publiés
  // et permet de les consulter, modifier et supprimer.
  await loadAdminMeetingReports();

}

/* ============================================================
   MAINTENANCE
   ============================================================ */

function openAdminMaintenanceMenu(){

  const maintenanceActive =
    adminDashboardData.maintenanceActive;


  openAdminPopup(

    '⚙️ Maintenance du système',

    `

      <div class="admin-menu-list">


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            backupSystemData();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            💾
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Sauvegarder le système
            </div>

            <div class="admin-menu-row-text">
              Télécharger une sauvegarde des données
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            restoreSystemData();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            📤
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Charger une sauvegarde
            </div>

            <div class="admin-menu-row-text">
              Restaurer les données du système
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            toggleMaintenanceMode();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            🚧
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Mode maintenance
            </div>

            <div class="admin-menu-row-text">
              ${
                maintenanceActive
                  ? 'Désactiver la maintenance'
                  : 'Activer la maintenance'
              }
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            openMaintenanceDiagnostic();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            🧪
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Diagnostic
            </div>

            <div class="admin-menu-row-text">
              Vérifier le fonctionnement du système
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


        <button
          type="button"
          class="admin-menu-row"
          onclick="
            openSystemHistory();
            closeAdminPopup();
          "
        >

          <div class="admin-menu-row-icon">
            📜
          </div>

          <div class="admin-menu-row-content">

            <div class="admin-menu-row-title">
              Historique du système
            </div>

            <div class="admin-menu-row-text">
              Consulter l'historique
            </div>

          </div>

          <div class="admin-menu-arrow">
            ›
          </div>

        </button>


      </div>


      <div
        style="
          margin-top:15px;
          padding:13px 15px;
          border-radius:14px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
        "
      >

        <strong>
          État de l'application :
        </strong>

        <span
          style="
            margin-left:7px;
            font-weight:800;
            color:
              ${
                maintenanceActive
                  ? '#dc2626'
                  : '#16a34a'
              };
          "
        >

          ${
            maintenanceActive
              ? '🚧 En maintenance'
              : '🟢 Opérationnelle'
          }

        </span>

      </div>

    `

  );

}


/* ============================================================
   SECTION IDÉES
   ============================================================ */

function showAdminIdeasSection(){

  closeAdminPopup();


  const ideas =
    adminDashboardData.ideas || [];

  const members =
    adminDashboardData.members || [];


  const html =
    ideas.length

      ? ideas.map(i => {

          const auteur =
            members.find(
              m =>
                String(m.id) ===
                String(i.member_id)
            );


          const nom =
            auteur
              ? `${auteur.first_name || ''} ${auteur.last_name || ''}`.trim()
              : `Membre inconnu (${i.member_id})`;


          const statut =
            i.status || 'new';


          const statutTexte =
            statut === 'read'
              ? '👁️ Lue'
              : statut === 'processed'
                ? '✅ Traitée'
                : '🆕 Nouvelle';


          return `

            <div
              class="admin-modern-item"
              style="margin-bottom:12px;"
            >

              <div class="admin-modern-item-title">
                👤 ${esc(nom)}
              </div>

              <p>
                ${esc(i.content || '')}
              </p>

              <div class="admin-modern-item-meta">
                📅 ${fmtDate(i.created_at)}
                · ${statutTexte}
              </div>


              ${
                i.admin_note

                  ? `

                    <div
                      style="
                        margin-top:10px;
                        padding:10px;
                        background:#f8fafc;
                        border-radius:10px;
                      "
                    >

                      <strong>
                        Note administrateur :
                      </strong>

                      <div>
                        ${esc(i.admin_note)}
                      </div>

                    </div>

                  `

                  : ''

              }


              <div
                style="
                  display:flex;
                  flex-wrap:wrap;
                  gap:8px;
                  margin-top:12px;
                "
              >

                ${
                  statut !== 'read' &&
                  statut !== 'processed'

                    ? `

                      <button
                        type="button"
                        class="secondary"
                        onclick="
                          setIdeaStatus('${i.id}','read');
                          closeAdminPopup();
                        "
                      >
                        👁️ Marquer lue
                      </button>

                    `

                    : ''

                }


                ${
                  statut !== 'processed'

                    ? `

                      <button
                        type="button"
                        class="secondary"
                        onclick="
                          setIdeaStatus('${i.id}','processed');
                          closeAdminPopup();
                        "
                      >
                        ✅ Traitée
                      </button>

                    `

                    : `

                      <button
                        type="button"
                        class="ghost"
                        onclick="
                          deleteIdea('${i.id}');
                          closeAdminPopup();
                        "
                      >
                        🗑️ Supprimer
                      </button>

                    `

                }

              </div>

            </div>

          `;

        }).join('')

      : `

        <div class="admin-empty-small">
          💡 Aucune idée proposée.
        </div>

      `;


  openAdminPopup(
    '💡 Boîte à idées',
    html
  );

}


/* ============================================================
   COMPOSITION
   ============================================================ */

function showAdminComposition(type){

  const members =
    adminDashboardData.members || [];

  const children =
    adminDashboardData.children || [];

  const reqs =
    adminDashboardData.requests || [];


  let title =
    '👥 Composition de l’Amicale';


  let html = '';


  if(type === 'members'){

    html = `

      <div class="admin-detail-stat">

        <div class="admin-detail-stat-box">

          <div class="admin-detail-stat-number">
            ${members.length}
          </div>

          <div class="admin-detail-stat-label">
            Membres
          </div>

        </div>

      </div>

    `;

  }


  if(type === 'active'){

    title =
      '🟢 Membres actifs';


    const list =
      members.filter(
        m =>
          String(m.status || '').toLowerCase()
          === 'actif'
      );


    html =
      list.length

        ? list.map(m => `

            <div class="admin-modern-item">

              <div class="admin-modern-item-title">

                ${esc(
                  `${m.first_name || ''} ${m.last_name || ''}`.trim()
                )}

              </div>

            </div>

          `).join('')

        : `
            <div class="admin-empty-small">
              Aucun membre actif.
            </div>
          `;

  }


  if(type === 'retired'){

    title =
      '⚪ Membres retraités';


    const list =
      members.filter(
        m =>
          String(m.status || '').toLowerCase()
          === 'retraite'
      );


    html =
      list.length

        ? list.map(m => `

            <div class="admin-modern-item">

              <div class="admin-modern-item-title">

                ${esc(
                  `${m.first_name || ''} ${m.last_name || ''}`.trim()
                )}

              </div>

            </div>

          `).join('')

        : `
            <div class="admin-empty-small">
              Aucun retraité.
            </div>
          `;

  }


  if(type === 'bureau'){

    title =
      '👔 Membres du bureau';


    const list =
      members.filter(
        m =>
          m.bureau_member === true
      );


    html =
      list.length

        ? list.map(m => `

            <div class="admin-modern-item">

              <div class="admin-modern-item-title">

                ${esc(
                  `${m.first_name || ''} ${m.last_name || ''}`.trim()
                )}

              </div>

            </div>

          `).join('')

        : `
            <div class="admin-empty-small">
              Aucun membre du bureau.
            </div>
          `;

  }


  if(type === 'children'){

    title =
      '👨‍👩‍👧 Enfants de moins de 16 ans';


    html = `

      <div class="admin-detail-stat">

        <div class="admin-detail-stat-box">

          <div class="admin-detail-stat-number">
            ${children.length}
          </div>

          <div class="admin-detail-stat-label">
            Enfants enregistrés
          </div>

        </div>

      </div>

    `;

  }


  if(type === 'loans'){

    title =
      '🧰 Prêts en cours';


    html = `

      <div class="admin-detail-stat">

        <div class="admin-detail-stat-box">

          <div class="admin-detail-stat-number">
            ${reqs.filter(
              r =>
                String(r.status).toLowerCase()
                === 'approved'
            ).length}
          </div>

          <div class="admin-detail-stat-label">
            Demandes approuvées
          </div>

        </div>

      </div>

    `;

  }


  openAdminPopup(
    title,
    html
  );

}

// =====================================================
// 👤 DESTINATAIRE MESSAGE ADMIN
// =====================================================

async function toggleAdminNoteRecipient(){

  const recipient =
    $('adminNoteRecipient')?.value || 'all';

  const memberSelect =
    $('adminNoteMember');


  if(!memberSelect)
    return;


  // Tous / Bureau
  if(recipient !== 'member'){

    memberSelect.style.display =
      'none';

    memberSelect.value =
      '';

    return;

  }


  // Membre précis
  memberSelect.style.display =
    'block';


  // Éviter de recharger inutilement
  if(
    memberSelect.dataset.loaded === 'true'
  ){

    return;

  }


  try{

    memberSelect.innerHTML = `
      <option value="">
        Chargement des membres...
      </option>
    `;


    const {
      data: members,
      error
    } = await db
      .from('members')
      .select(
        'id, first_name, last_name'
      )
      .eq(
        'active',
        true
      )
      .order(
        'last_name',
        {
          ascending:true
        }
      );


    if(error)
      throw error;


    memberSelect.innerHTML = `
      <option value="">
        Sélectionner un membre...
      </option>
    `;


    (members || []).forEach(m => {

      const option =
        document.createElement('option');

      option.value =
        m.id;

      option.textContent =
        `${m.first_name || ''} ${m.last_name || ''}`
          .trim();


      memberSelect.appendChild(
        option
      );

    });


    memberSelect.dataset.loaded =
      'true';


  }catch(error){

    console.error(
      '❌ ERREUR CHARGEMENT MEMBRES :',
      error
    );


    memberSelect.innerHTML = `
      <option value="">
        ❌ Impossible de charger les membres
      </option>
    `;

  }

}


window.toggleAdminNoteRecipient =
  toggleAdminNoteRecipient;

// =========================================================
// 📄 DOCUMENTS DE TRAVAIL DU BUREAU
// =========================================================

async function showAdminWorkDocuments(){

  if(!member || member.role !== 'admin'){

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  try{

    const { data, error } = await db

      .from('bureau_work_documents')

      .select('*')

      .order(
        'created_at',
        {
          ascending:false
        }
      );


    if(error){

      console.error(
        'ERREUR CHARGEMENT DOCUMENTS :',
        error
      );

      alert(
        '❌ Impossible de charger les documents.'
      );

      return;
    }


    const documents = data || [];


    openModal(`

      <h2>
        📄 Documents de travail du bureau
      </h2>

      <p class="muted">
        Créez et gérez les différents documents
        de travail du bureau.
      </p>


      <button
        type="button"
        class="primary"
        onclick="newBureauWorkDocument()"
        style="margin-top:10px;"
      >
        ➕ Créer un document
      </button>


      <div
        style="
          margin-top:18px;
        "
      >

        ${
          documents.length

          ? documents.map(d => `

              <div
                class="card"
                style="
                  margin-bottom:10px;
                  padding:15px;
                "
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:12px;
                    flex-wrap:wrap;
                  "
                >

                  <div>

                    <h3 style="margin:0 0 5px 0;">
                      📄 ${esc(d.title)}
                    </h3>

                    ${
                      d.description
                        ? `
                          <p
                            class="muted"
                            style="margin:0;"
                          >
                            ${esc(d.description)}
                          </p>
                        `
                        : ''
                    }

                  </div>


                  <div
                    class="row"
                    style="
                      gap:6px;
                      flex-wrap:wrap;
                    "
                  >

                    <button
                      type="button"
                      class="primary"
                      onclick="openBureauWorkDocument('${d.id}')"
                    >
                      📂 Ouvrir
                    </button>

                    <button
                      type="button"
                      class="ghost"
                      onclick="editBureauWorkDocument('${d.id}')"
                    >
                      ✏️ Modifier
                    </button>

                    <button
                      type="button"
                      class="ghost"
                      style="color:#b00000;"
                      onclick="deleteBureauWorkDocument('${d.id}')"
                    >
                      🗑️ Supprimer
                    </button>

                  </div>

                </div>

              </div>

            `).join('')

          : `

            <div
              class="card"
              style="margin-top:15px;"
            >

              <p
                class="muted"
                style="margin:0;"
              >
                📭 Aucun document de travail créé.
              </p>

            </div>

          `
        }

      </div>


      <div
        class="row"
        style="
          margin-top:18px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR SHOW ADMIN WORK DOCUMENTS :',
      error
    );

    alert(
      error?.message ||
      '❌ Une erreur est survenue.'
    );

  }

}


window.showAdminWorkDocuments =
  showAdminWorkDocuments;

async function showAdminNoteReaders(noteId){

  try{

    // =====================================================
    // 👁️ RÉCUPÉRER LES LECTURES DU MESSAGE
    // =====================================================

    const {data:reads,error:readsError} =
      await db
        .from('admin_note_reads')
        .select(`
          member_id,
          read_at
        `)
        .eq(
          'note_id',
          noteId
        )
        .order(
          'read_at',
          {
            ascending:true
          }
        );


    if(readsError)
      throw readsError;


    const messageReads =
      reads || [];


    // =====================================================
    // 👥 RÉCUPÉRER LES MEMBRES
    // =====================================================

    const {data:members,error:membersError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name
        `);


    if(membersError)
      throw membersError;


    const allMembers =
      members || [];


    // =====================================================
    // 📝 CONSTRUIRE LA LISTE
    // =====================================================

    let readersHtml = '';


    if(!messageReads.length){

      readersHtml = `

        <div class="card">

          <p>
            👁️ Personne n'a encore lu ce message.
          </p>

        </div>

      `;

    }else{

      readersHtml =
        messageReads.map(read => {

          const person =
            allMembers.find(
              m =>
                String(m.id) ===
                String(read.member_id)
            );


          const name =
            person

              ? `${person.first_name || ''} ${person.last_name || ''}`.trim()

              : 'Membre inconnu';


          const date =
            read.read_at
              ? new Date(
                  read.read_at
                ).toLocaleDateString(
                  'fr-FR'
                )
              : '';


          const time =
            read.read_at
              ? new Date(
                  read.read_at
                ).toLocaleTimeString(
                  'fr-FR',
                  {
                    hour:'2-digit',
                    minute:'2-digit'
                  }
                )
              : '';


          return `

            <div
              class="card"
              style="
                margin-bottom:10px;
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
              "
            >

              <div>

                <strong>
                  👤 ${esc(name)}
                </strong>

              </div>


              <small class="muted">

                ${date}
                ${time ? ` à ${time}` : ''}

              </small>

            </div>

          `;

        }).join('');

    }


    // =====================================================
    // 📨 AFFICHER LA LISTE
    // =====================================================

    openModal(`

      <h2>
        👁️ Personnes ayant lu le message
      </h2>


      <p
        class="muted"
        style="
          margin-bottom:15px;
        "
      >

        ${
          messageReads.length
        }

        ${
          messageReads.length === 1
            ? 'personne a lu ce message.'
            : 'personnes ont lu ce message.'
        }

      </p>


      <div>

        ${readersHtml}

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="showAdminMessages()"
        >

          ← Retour aux messages

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR CHARGEMENT LECTEURS MESSAGE :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger les personnes ayant lu le message.'
    );

  }

}


window.showAdminNoteReaders =
  showAdminNoteReaders;

async function openBureauWorkDocumentsUser(){

  if(
    !member ||
    member.bureau_member !== true
  ){
    alert('❌ Accès réservé aux membres du bureau.');
    return;
  }

  try{

    const { data, error } = await db
      .from('bureau_work_documents')
      .select('*')
      .order('created_at', { ascending:false });

    if(error){
      console.error(
        'ERREUR CHARGEMENT DOCUMENTS USER :',
        error
      );

      alert(
        '❌ Impossible de charger les documents.'
      );

      return;
    }

    const documents = data || [];

    openModal(`

      <h2>📄 Documents de travail du bureau</h2>

      <p class="muted">
        Consultez les documents de travail et les actions du bureau.
      </p>

      <div style="margin-top:18px;">

        ${
          documents.length

          ? documents.map(d => `

              <div
                class="card"
                style="
                  margin-bottom:10px;
                  padding:15px;
                "
              >

                <h3 style="margin:0 0 5px 0;">
                  📄 ${esc(d.title)}
                </h3>

                ${
                  d.description
                    ? `
                      <p
                        class="muted"
                        style="margin:0;"
                      >
                        ${esc(d.description)}
                      </p>
                    `
                    : ''
                }

                <button
                  type="button"
                  class="primary"
                  style="margin-top:10px;"
                  onclick="openBureauWorkDocument('${d.id}')"
                >
                  📂 Ouvrir
                </button>

              </div>

            `).join('')

          : `
            <div class="card">
              <p class="muted">
                📭 Aucun document de travail disponible.
              </p>
            </div>
          `
        }

      </div>

      <div
        class="row"
        style="
          margin-top:18px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR OPEN USER WORK DOCUMENTS :',
      error
    );

    alert(
      error?.message ||
      '❌ Une erreur est survenue.'
    );
  }
}

window.openBureauWorkDocumentsUser =
  openBureauWorkDocumentsUser;




function newBureauWorkDocument(){

  if(!member || member.role !== 'admin'){

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  openModal(`

    <h2>
      📄 Nouveau document de travail
    </h2>

    <div style="margin-top:15px;">

      <label>
        <strong>
          Nom du document
        </strong>
      </label>

      <input
        id="bureauWorkDocumentTitle"
        type="text"
        placeholder="Ex : Préparation Sainte-Barbe 2026"
        style="
          width:100%;
          margin-top:6px;
        "
      >

    </div>


    <div style="margin-top:15px;">

      <label>
        <strong>
          Description
        </strong>
      </label>

      <textarea
        id="bureauWorkDocumentDescription"
        rows="4"
        placeholder="Description ou objectif du document..."
        style="
          width:100%;
          margin-top:6px;
          resize:vertical;
        "
      ></textarea>

    </div>


    <div
      class="row"
      style="
        justify-content:flex-end;
        gap:8px;
        margin-top:20px;
      "
    >

      <button
        type="button"
        class="ghost"
        onclick="closeModal()"
      >
        Annuler
      </button>

      <button
        type="button"
        class="primary"
        onclick="saveBureauWorkDocument()"
      >
        💾 Créer le document
      </button>

    </div>

  `);

}


// =========================================================
// 💾 ENREGISTRER LE DOCUMENT
// =========================================================

async function saveBureauWorkDocument(){

  if(!member || member.role !== 'admin'){

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  const title =
    document
      .getElementById('bureauWorkDocumentTitle')
      ?.value
      ?.trim();


  const description =
    document
      .getElementById('bureauWorkDocumentDescription')
      ?.value
      ?.trim();


  if(!title){

    alert(
      '⚠️ Veuillez renseigner le nom du document.'
    );

    return;
  }


  try{

    const { data, error } = await db

      .from('bureau_work_documents')

      .insert({

        title: title,

        description:
          description || null,

        created_by:
          member.id

      })

      .select()

      .maybeSingle();


    if(error){

      console.error(
        'ERREUR CRÉATION DOCUMENT :',
        error
      );

      alert(
        '❌ Impossible de créer le document.\n\n' +
        (
          error.message ||
          'Erreur inconnue'
        )
      );

      return;
    }

sendAdminEmailNotification(
  'work_document',
  '📄 Nouveau document de travail',
  `Document : ${title}

Description : ${description || 'Aucune description.'}`,
  `${member.first_name || ''} ${member.last_name || ''}`.trim()
);

closeModal();

    
    closeModal();


    alert(
      '✅ Document de travail créé avec succès !'
    );


    // Réouvre la liste des documents
    showAdminWorkDocuments();


  }catch(error){

    console.error(
      'ERREUR SAVE BUREAU WORK DOCUMENT :',
      error
    );

    alert(
      '❌ Une erreur est survenue lors de la création.'
    );

  }

}


window.newBureauWorkDocument = newBureauWorkDocument;
window.saveBureauWorkDocument = saveBureauWorkDocument;

console.log('✅ DOCUMENTS DE TRAVAIL : fonctions chargées');
console.log('newBureauWorkDocument =', typeof window.newBureauWorkDocument);
console.log('saveBureauWorkDocument =', typeof window.saveBureauWorkDocument);

// =========================================================
// 📄 LISTE DES DOCUMENTS DE TRAVAIL
// =========================================================






async function openBureauWorkDocument(documentId) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Cette fonctionnalité est réservée aux membres du bureau.'
    );

    return;
  }


  try {

    const { data: documentData, error: documentError } =
      await db
        .from('bureau_work_documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();


    if (documentError) {

      console.error(
        'ERREUR DOCUMENT :',
        documentError
      );

      alert(
        '❌ Impossible de charger le document.\n\n' +
        documentError.message
      );

      return;
    }


    if (!documentData) {

      alert(
        '❌ Document introuvable.'
      );

      return;
    }


    const { data: actions, error: actionsError } =
      await db
        .from('bureau_work_actions')
        .select('*')
        .eq('document_id', documentId)
        .order(
          'created_at',
          {
            ascending: true
          }
        );

console.log(
  '🔎 ACTIONS CHARGÉES POUR LE DOCUMENT :',
  actions
);
    
    if (actionsError) {

      console.error(
        'ERREUR ACTIONS :',
        actionsError
      );

      alert(
        '❌ Impossible de charger les actions.\n\n' +
        actionsError.message
      );

      return;
    }


    const actionList =
      actions || [];


    // =====================================================
    // 👥 CHARGER LES MEMBRES
    // =====================================================

    const memberIds =
      [...new Set(
        actionList
          .map(function(a) {
            return a.member_id;
          })
          .filter(Boolean)
      )];


    let membersMap = {};


    if (memberIds.length) {

      const { data: bureauMembers, error: membersError } =
        await db
          .from('members')
          .select('id, first_name, last_name')
          .in('id', memberIds);


      if (membersError) {

        console.error(
          'ERREUR MEMBRES :',
          membersError
        );

      } else {

        (bureauMembers || []).forEach(function(m) {

          membersMap[m.id] =
            (
              (m.first_name || '') +
              ' ' +
              (m.last_name || '')
            ).trim();

        });

      }

    }


    // =====================================================
    // 🧾 AFFICHAGE DES ACTIONS
    // =====================================================

    let actionsHtml = '';


    if (!actionList.length) {

      actionsHtml = `

        <div
          class="card"
          style="
            margin-top:18px;
            text-align:center;
          "
        >

          <p class="muted">
            📭 Aucune action pour le moment.
          </p>

        </div>

      `;

    } else {

      actionsHtml =
        actionList.map(function(a) {

          const memberName =
            membersMap[a.member_id] ||
            'Membre du bureau';


          const isDone =
            a.status === 'fait';


          return `

            <div
              class="card"
              style="
                margin-top:10px;
                padding:14px;
                border-left:
                  5px solid
                  ${isDone ? '#1b8f3a' : '#c1121f'};
              "
            >

     <div
  class="action-grid"
  style="
    display:grid;
    grid-template-columns:90px 140px minmax(0,2fr);
    gap:10px;
    width:100%;
  "
>

                <!-- STATUT -->

                <div>

                  ${
                    isDone

                    ? `

                      <span
                        style="
                          display:inline-block;
                          padding:6px 9px;
                          border-radius:8px;
                          background:#dff5e5;
                          color:#187536;
                          font-weight:700;
                        "
                      >
                        ✅ FAIT
                      </span>

                    `

                    : `

                      <span
                        style="
                          display:inline-block;
                          padding:6px 9px;
                          border-radius:8px;
                          background:#fde1e3;
                          color:#b5121b;
                          font-weight:700;
                        "
                      >
                        🔴 À FAIRE
                      </span>

                    `
                  }

                </div>


        <!-- MEMBRE -->

<div>

  <strong>
    👤 ${esc(memberName).replace(' ', '<br>')}
  </strong>

</div>


                <!-- ACTION -->

                <div>

                  ${esc(a.action)}

                </div>

              </div>


              <div
                style="
                  display:flex;
                  justify-content:flex-end;
                  gap:15px;
                  margin-top:10px;
                  flex-wrap:wrap;
                "
              >

                ${
                  member.role === 'admin'

                  ? `

                    <button
                      type="button"
                      class="ghost"
                      onclick="
                        toggleBureauWorkAction(
                          '${a.id}',
                          '${documentId}',
                          '${a.status}'
                        )
                      "
                    >
                      ${
                        isDone
                          ? '↩️ Remettre à faire'
                          : '✅ Marquer comme fait'
                      }
                    </button>


                    <button
                      type="button"
                      class="ghost"
                      onclick="
                        editBureauWorkAction(
                          '${a.id}',
                          '${documentId}'
                        )
                      "
                    >
                      ✏️ Modifier
                    </button>


                    <button
                      type="button"
                      class="ghost"
                      style="color:#b00000;"
                      onclick="
                        deleteBureauWorkAction(
                          '${a.id}',
                          '${documentId}'
                        )
                      "
                    >
                      🗑️ Supprimer
                    </button>

                  `

                  : (

                    a.member_id === member.id

                    ? `

                      <button
                        type="button"
                        class="ghost"
                        onclick="
                          toggleBureauWorkAction(
                            '${a.id}',
                            '${documentId}',
                            '${a.status}'
                          )
                        "
                      >
                        ${
                          isDone
                            ? '↩️ Remettre à faire'
                            : '✅ Marquer comme fait'
                        }
                      </button>


                      <button
                        type="button"
                        class="ghost"
                        onclick="
                          editBureauWorkAction(
                            '${a.id}',
                            '${documentId}'
                          )
                        "
                      >
                        ✏️ Modifier
                      </button>


                      <button
                        type="button"
                        class="ghost"
                        style="color:#b00000;"
                        onclick="
                          deleteBureauWorkAction(
                            '${a.id}',
                            '${documentId}'
                          )
                        "
                      >
                        🗑️ Supprimer
                      </button>

                    `

                    : ''

                  )
                }

              </div>

            </div>

          `;

        }).join('');

    }


    // =====================================================
    // 📄 AFFICHAGE DU DOCUMENT
    // =====================================================

    openModal(`

      <h2>
        📄 ${esc(documentData.title)}
      </h2>


      ${
        documentData.description

        ? `

          <p class="muted">
            ${esc(documentData.description)}
          </p>

        `

        : ''
      }


      <div
        class="row"
        style="
          margin-top:15px;
          gap:8px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="
            addBureauWorkAction('${documentId}')
          "
        >
          ➕ Ajouter une action
        </button>


        <button
          type="button"
          class="ghost"
          onclick="
            printBureauWorkDocument('${documentId}')
          "
        >
          🖨️ Imprimer
        </button>

      </div>


      <div style="margin-top:20px;">

        <h3>
          📋 Récapitulatif des actions
        </h3>


        ${actionsHtml}

      </div>


      <div
        class="row"
        style="
          justify-content:flex-end;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="
            closeModal();
            ${
              member.role === 'admin'
                ? 'showAdminWorkDocuments();'
                : ''
            }
          "
        >
          ↩️ Retour
        </button>

      </div>

    `);


  } catch (error) {

    console.error(
      'ERREUR OPEN BUREAU WORK DOCUMENT :',
      error
    );

    alert(
      '❌ Impossible d’ouvrir le document.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}


// =========================================================
// ➕ AJOUTER UNE ACTION
// =========================================================

async function addBureauWorkAction(documentId) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Cette fonctionnalité est réservée aux membres du bureau.'
    );

    return;
  }


  try {

    let bureauMembers = [];


    if (member.role === 'admin') {

      const { data, error } =
        await db
          .from('members')
          .select('id, first_name, last_name')
          .eq('bureau_member', true)
          .order(
            'last_name',
            {
              ascending: true
            }
          );


      if (error) {

        alert(
          '❌ Impossible de charger les membres du bureau.\n\n' +
          error.message
        );

        return;
      }


      bureauMembers =
        data || [];

    }


    // =====================================================
    // 👑 ADMIN
    // =====================================================

    if (member.role === 'admin') {

      const options =
        bureauMembers.map(function(m) {

          const name =
            (
              (m.first_name || '') +
              ' ' +
              (m.last_name || '')
            ).trim();


          return `

            <option value="${m.id}">
              ${esc(name)}
            </option>

          `;

        }).join('');


      openModal(`

        <h2>
          ➕ Ajouter une action
        </h2>


        <div style="margin-top:18px;">

          <label>
            <strong>
              Membre du bureau
            </strong>
          </label>


          <select
            id="bureauWorkActionMember"
            style="
              width:100%;
              margin-top:7px;
              box-sizing:border-box;
            "
          >

            ${options}

          </select>

        </div>


        <div style="margin-top:18px;">

          <label>
            <strong>
              Action à réaliser
            </strong>
          </label>


          <textarea
            id="bureauWorkActionText"
            rows="4"
            placeholder="Ex : Contacter la mairie..."
            style="
              width:100%;
              margin-top:7px;
              resize:vertical;
              box-sizing:border-box;
            "
          ></textarea>

        </div>


        <div
          class="row"
          style="
            justify-content:flex-end;
            gap:8px;
            margin-top:20px;
          "
        >

          <button
            type="button"
            class="ghost"
            onclick="closeModal()"
          >
            Annuler
          </button>


          <button
            type="button"
            class="primary"
            onclick="
              saveBureauWorkAction(
                '${documentId}',
                document.getElementById(
                  'bureauWorkActionMember'
                ).value
              )
            "
          >
            💾 Ajouter l'action
          </button>

        </div>

      `);

      return;
    }


    // =====================================================
    // 👤 MEMBRE DU BUREAU
    // =====================================================

    const memberName =
      (
        (member.first_name || '') +
        ' ' +
        (member.last_name || '')
      ).trim();


    openModal(`

      <h2>
        ➕ Ajouter une action
      </h2>


      <p class="muted">

        Action ajoutée au nom de :

        <strong>
          ${esc(memberName)}
        </strong>

      </p>


      <div style="margin-top:18px;">

        <label>
          <strong>
            Action à réaliser
          </strong>
        </label>


        <textarea
          id="bureauWorkActionText"
          rows="4"
          placeholder="Ex : Contacter la mairie..."
          style="
            width:100%;
            margin-top:7px;
            resize:vertical;
            box-sizing:border-box;
          "
        ></textarea>

      </div>


      <div
        class="row"
        style="
          justify-content:flex-end;
          gap:8px;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Annuler
        </button>


        <button
          type="button"
          class="primary"
          onclick="
            saveBureauWorkAction(
              '${documentId}',
              '${member.id}'
            )
          "
        >
          💾 Ajouter l'action
        </button>

      </div>

    `);

  } catch (error) {

    console.error(
      'ERREUR ADD ACTION :',
      error
    );

    alert(
      '❌ Une erreur est survenue.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}




// =========================================================
// ✅ MARQUER UNE ACTION COMME FAITE / À FAIRE
// =========================================================

async function toggleBureauWorkActionStatus(actionId, currentStatus){

  if(!member || member.role !== 'admin'){
    alert('❌ Réservé à l’administrateur.');
    return;
  }

  const newStatus =
    currentStatus === 'fait'
      ? 'a_faire'
      : 'fait';

  try{

    const { error } = await db
      .from('bureau_work_actions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId);

    if(error){

      console.error(
        'ERREUR STATUT ACTION :',
        error
      );

      alert(
        '❌ Impossible de modifier le statut.\n\n' +
        (error.message || 'Erreur inconnue')
      );

      return;
    }

    if(typeof openBureauWorkDocument === 'function'){

      const action =
        document.querySelector(
          `[data-bureau-action-document="${actionId}"]`
        );

    }

    location.reload();

  }catch(error){

    console.error(
      'ERREUR TOGGLE ACTION :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );
  }
}


// =========================================================
// ✅ RACCOURCI : MARQUER COMME FAIT
// =========================================================

async function markBureauWorkActionDone(actionId){

  if(!member || member.role !== 'admin'){
    alert('❌ Réservé à l’administrateur.');
    return;
  }

  try{

    const { error } = await db
      .from('bureau_work_actions')
      .update({
        status: 'fait',
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId);

    if(error){

      console.error(
        'ERREUR ACTION FAITE :',
        error
      );

      alert(
        '❌ Impossible de marquer l’action comme faite.\n\n' +
        (error.message || 'Erreur inconnue')
      );

      return;
    }

    location.reload();

  }catch(error){

    console.error(
      'ERREUR MARK ACTION DONE :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );
  }
}


// =========================================================
// ✏️ MODIFIER UNE ACTION
// =========================================================

async function updateBureauWorkAction(actionId){

  if(!member || member.role !== 'admin'){
    alert('❌ Réservé à l’administrateur.');
    return;
  }

  const { data, error } = await db
    .from('bureau_work_actions')
    .select('id, action, status, document_id')
    .eq('id', actionId)
    .maybeSingle();

  if(error){

    console.error(
      'ERREUR CHARGEMENT ACTION :',
      error
    );

    alert(
      '❌ Impossible de charger l’action.'
    );

    return;
  }

  if(!data){

    alert('❌ Action introuvable.');
    return;
  }

  openModal(`

    <h2>✏️ Modifier l'action</h2>

    <div style="margin-top:18px;">

      <label>
        <strong>Action à réaliser</strong>
      </label>

      <textarea
        id="editBureauWorkActionText"
        rows="5"
        style="
          width:100%;
          margin-top:8px;
          resize:vertical;
        "
      >${esc(data.action || '')}</textarea>

    </div>

    <div
      class="row"
      style="
        justify-content:flex-end;
        gap:8px;
        margin-top:20px;
      "
    >

      <button
        type="button"
        class="ghost"
        onclick="closeModal()"
      >
        Annuler
      </button>

      <button
        type="button"
        class="primary"
        onclick="saveEditedBureauWorkAction('${data.id}')"
      >
        💾 Enregistrer
      </button>

    </div>

  `);
}


// =========================================================
// 💾 ENREGISTRER LA MODIFICATION
// =========================================================






// =========================================================
// 🌐 EXPOSITION DES FONCTIONS
// =========================================================

window.toggleBureauWorkActionStatus =
  toggleBureauWorkActionStatus;

window.markBureauWorkActionDone =
  markBureauWorkActionDone;

window.updateBureauWorkAction =
  updateBureauWorkAction;

window.saveEditedBureauWorkAction =
  saveEditedBureauWorkAction;

window.deleteBureauWorkAction =
  deleteBureauWorkAction;


// =========================================================
// ✏️ MODIFIER UN DOCUMENT
// =========================================================

async function editBureauWorkDocument(id) {

  if (!member || member.role !== 'admin') {

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  try {

    const { data, error } =
      await db
        .from('bureau_work_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();


    if (error) throw error;


    if (!data) {

      alert(
        '❌ Document introuvable.'
      );

      return;
    }


    openModal(`

      <h2>
        ✏️ Modifier le document
      </h2>


      <div style="margin-top:15px;">

        <label>
          <strong>
            Nom du document
          </strong>
        </label>


        <input
          id="editBureauWorkDocumentTitle"
          type="text"
          value="${esc(data.title || '')}"
          style="
            width:100%;
            margin-top:6px;
            box-sizing:border-box;
          "
        >

      </div>


      <div style="margin-top:15px;">

        <label>
          <strong>
            Description
          </strong>
        </label>


        <textarea
          id="editBureauWorkDocumentDescription"
          rows="4"
          style="
            width:100%;
            margin-top:6px;
            resize:vertical;
            box-sizing:border-box;
          "
        >${esc(data.description || '')}</textarea>

      </div>


      <div
        class="row"
        style="
          justify-content:flex-end;
          gap:8px;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal();showAdminWorkDocuments();"
        >
          Annuler
        </button>


        <button
          type="button"
          class="primary"
          onclick="
            saveEditedBureauWorkDocument('${id}')
          "
        >
          💾 Enregistrer
        </button>

      </div>

    `);

  } catch (error) {

    console.error(
      'ERREUR EDIT DOCUMENT :',
      error
    );

    alert(
      '❌ Impossible de modifier le document.'
    );

  }

}


// =========================================================
// 💾 ENREGISTRER MODIFICATION DOCUMENT
// =========================================================

async function saveEditedBureauWorkDocument(id) {

  if (!member || member.role !== 'admin') {

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  const title =
    document
      .getElementById(
        'editBureauWorkDocumentTitle'
      )
      ?.value
      ?.trim();


  const description =
    document
      .getElementById(
        'editBureauWorkDocumentDescription'
      )
      ?.value
      ?.trim();


  if (!title) {

    alert(
      '⚠️ Le nom du document est obligatoire.'
    );

    return;
  }


  try {

    const { error } =
      await db
        .from('bureau_work_documents')
        .update({

          title:
            title,

          description:
            description || null,

          updated_at:
            new Date().toISOString()

        })
        .eq('id', id);


    if (error) throw error;


    closeModal();


    await showAdminWorkDocuments();


  } catch (error) {

    console.error(
      'ERREUR UPDATE DOCUMENT :',
      error
    );

    alert(
      '❌ Impossible de modifier le document.\n\n' +
      error.message
    );

  }

}


// =========================================================
// 🗑️ SUPPRIMER UN DOCUMENT
// =========================================================

async function deleteBureauWorkDocument(id) {

  if (!member || member.role !== 'admin') {

    alert(
      '❌ Accès réservé à l’administrateur.'
    );

    return;
  }


  if (
    !confirm(
      '⚠️ Voulez-vous vraiment supprimer ce document ?\n\n' +
      'Toutes les actions associées seront également supprimées.'
    )
  ) {

    return;
  }


  try {

    // Supprimer d'abord les actions
    const { error: actionsError } =
      await db
        .from('bureau_work_actions')
        .delete()
        .eq('document_id', id);


    if (actionsError) {

      console.error(
        'ERREUR SUPPRESSION ACTIONS :',
        actionsError
      );

      alert(
        '❌ Impossible de supprimer les actions.\n\n' +
        actionsError.message
      );

      return;
    }


    const { error } =
      await db
        .from('bureau_work_documents')
        .delete()
        .eq('id', id);


    if (error) throw error;


    alert(
      '✅ Document supprimé.'
    );


    await showAdminWorkDocuments();


  } catch (error) {

    console.error(
      'ERREUR DELETE DOCUMENT :',
      error
    );

    alert(
      '❌ Impossible de supprimer le document.\n\n' +
      error.message
    );

  }

}


// =========================================================
// 🔄 CHANGER LE STATUT D'UNE ACTION
// =========================================================

async function toggleBureauWorkAction(
  actionId,
  documentId,
  currentStatus
) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;
  }


  const newStatus =
    currentStatus === 'fait'
      ? 'a_faire'
      : 'fait';


  try {

    const { error } =
      await db
        .from('bureau_work_actions')
        .update({

          status:
            newStatus,

          updated_at:
            new Date().toISOString()

        })
        .eq('id', actionId);


    if (error) throw error;


    await openBureauWorkDocument(
      documentId
    );


  } catch (error) {

    console.error(
      'ERREUR STATUT ACTION :',
      error
    );

    alert(
      '❌ Impossible de modifier le statut.\n\n' +
      error.message
    );

  }

}


// =========================================================
// ✏️ MODIFIER UNE ACTION
// =========================================================

async function editBureauWorkAction(
  actionId,
  documentId
) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;
  }


  try {

    const { data, error } =
      await db
        .from('bureau_work_actions')
        .select('*')
        .eq('id', actionId)
        .maybeSingle();


    if (error) throw error;


    if (!data) {

      alert(
        '❌ Action introuvable.'
      );

      return;
    }


    openModal(`

      <h2>
        ✏️ Modifier l'action
      </h2>


      <textarea
        id="editBureauWorkActionText"
        rows="5"
        style="
          width:100%;
          margin-top:15px;
          box-sizing:border-box;
          resize:vertical;
        "
      >${esc(data.action || '')}</textarea>


      <div
        class="row"
        style="
          justify-content:flex-end;
          gap:8px;
          margin-top:20px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="
            closeModal();
            openBureauWorkDocument('${documentId}');
          "
        >
          Annuler
        </button>


        <button
          type="button"
          class="primary"
          onclick="
            saveEditedBureauWorkAction(
              '${actionId}',
              '${documentId}'
            )
          "
        >
          💾 Enregistrer
        </button>

      </div>

    `);

  } catch (error) {

    console.error(
      'ERREUR EDIT ACTION :',
      error
    );

    alert(
      '❌ Impossible de modifier l’action.'
    );

  }

}


// =========================================================
// 💾 ENREGISTRER MODIFICATION ACTION
// =========================================================

async function saveEditedBureauWorkAction(
  actionId,
  documentId
) {

  const action =
    document
      .getElementById(
        'editBureauWorkActionText'
      )
      ?.value
      ?.trim();


  if (!action) {

    alert(
      '⚠️ L’action ne peut pas être vide.'
    );

    return;
  }


  if (!actionId) {

    alert(
      '❌ Identifiant de l’action introuvable.'
    );

    console.error(
      'ACTION ID MANQUANT :',
      actionId
    );

    return;
  }


  try {

    const { data, error } =
      await db
        .from('bureau_work_actions')
        .update({

          action: action,

          updated_at:
            new Date().toISOString()

        })
        .eq('id', actionId)
        .select('id, action, member_id, status')
        .maybeSingle();


    if (error) {

      console.error(
        'ERREUR UPDATE ACTION :',
        error
      );

      alert(
        '❌ Impossible de modifier l’action.\n\n' +
        error.message
      );

      return;
    }


    // =====================================================
    // ⚠️ AUCUNE LIGNE MODIFIÉE
    // =====================================================

    if (!data) {

      console.error(
        'AUCUNE ACTION MODIFIÉE.',
        {
          actionId: actionId,
          action: action
        }
      );

      alert(
        '❌ La modification n’a pas été enregistrée.\n\n' +
        'L’action n’a pas pu être modifiée.'
      );

      return;
    }


    console.log(
      '✅ ACTION MODIFIÉE :',
      data
    );


    closeModal();


    await openBureauWorkDocument(
      documentId
    );


  } catch (error) {

    console.error(
      'ERREUR SAVE EDIT ACTION :',
      error
    );

    alert(
      '❌ Une erreur est survenue lors de la modification.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}

// =========================================================
// 🗑️ SUPPRIMER UNE ACTION
// =========================================================

async function deleteBureauWorkAction(
  actionId,
  documentId
) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Accès réservé aux membres du bureau.'
    );

    return;
  }

  if (
    !confirm(
      '⚠️ Voulez-vous supprimer cette action ?'
    )
  ) {
    return;
  }

  try {

    console.log(
      '🗑️ SUPPRESSION DEMANDÉE :',
      actionId
    );

    const { error } = await db
      .from('bureau_work_actions')
      .delete()
      .eq('id', actionId);

    console.log(
      '🗑️ RÉSULTAT SUPPRESSION :',
      error
    );

    if (error) {

      console.error(
        'ERREUR SUPPRESSION ACTION :',
        error
      );

      alert(
        '❌ Impossible de supprimer l’action.\n\n' +
        (
          error.message ||
          'Erreur inconnue'
        )
      );

      return;
    }

    alert('✅ Suppression effectuée.');

    await openBureauWorkDocument(
      documentId
    );

  } catch (error) {

    console.error(
      'ERREUR DELETE ACTION :',
      error
    );

    alert(
      '❌ Une erreur est survenue lors de la suppression.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}
// =========================================================
// 🖨️ IMPRESSION DU DOCUMENT
// =========================================================

async function printBureauWorkDocument(documentId) {

  try {

    const { data: documentData, error: documentError } =
      await db
        .from('bureau_work_documents')
        .select('*')
        .eq('id', documentId)
        .maybeSingle();


    if (documentError) throw documentError;


    const { data: actions, error: actionsError } =
      await db
        .from('bureau_work_actions')
        .select('*')
        .eq('document_id', documentId)
        .order(
          'created_at',
          {
            ascending: true
          }
        );


    if (actionsError) throw actionsError;


    const actionList =
      actions || [];


    const memberIds =
      [...new Set(
        actionList
          .map(function(a) {
            return a.member_id;
          })
          .filter(Boolean)
      )];


    let membersMap = {};


    if (memberIds.length) {

      const { data: membersData } =
        await db
          .from('members')
          .select('id, first_name, last_name')
          .in('id', memberIds);


      (membersData || []).forEach(function(m) {

        membersMap[m.id] =
          (
            (m.first_name || '') +
            ' ' +
            (m.last_name || '')
          ).trim();

      });

    }


    const rows =
      actionList.map(function(a) {

        const done =
          a.status === 'fait';


        return `

          <tr>

            <td
              style="
                color:${done ? '#188038' : '#c1121f'};
                font-weight:bold;
              "
            >
              ${done ? 'FAIT' : 'À FAIRE'}
            </td>


            <td>
              ${esc(
                membersMap[a.member_id] ||
                'Membre du bureau'
              )}
            </td>


            <td>
              ${esc(a.action || '')}
            </td>

          </tr>

        `;

      }).join('');


    const printWindow =
      window.open(
        '',
        '_blank'
      );


    if (!printWindow) {

      alert(
        '⚠️ Le navigateur bloque la fenêtre d’impression.'
      );

      return;
    }


    printWindow.document.write(`

      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>
          ${esc(documentData.title)}
        </title>

        <style>

          body {
            font-family: Arial, sans-serif;
            padding: 30px;
          }

          h1 {
            margin-bottom: 5px;
          }

          .description {
            color:#666;
            margin-bottom:25px;
          }

          table {
            width:100%;
            border-collapse:collapse;
          }

          th,
          td {
            border:1px solid #ccc;
            padding:10px;
            text-align:left;
          }

          th {
            background:#f2f2f2;
          }

        </style>

      </head>


      <body>

        <h1>
          📄 ${esc(documentData.title)}
        </h1>


        ${
          documentData.description

          ? `

            <div class="description">
              ${esc(documentData.description)}
            </div>

          `

          : ''
        }


        <table>

          <thead>

            <tr>

              <th>
                Statut
              </th>

              <th>
                Membre
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            ${rows}

          </tbody>

        </table>


      </body>

      </html>

    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(function() {

      printWindow.print();

    }, 300);


  } catch (error) {

    console.error(
      'ERREUR IMPRESSION :',
      error
    );

    alert(
      '❌ Impossible d’imprimer le document.\n\n' +
      error.message
    );

  }

}


// =========================================================
// 🌐 EXPOSER LES FONCTIONS
// =========================================================

window.newBureauWorkDocument =
  newBureauWorkDocument;

window.saveBureauWorkDocument =
  saveBureauWorkDocument;

window.showAdminWorkDocuments =
  showAdminWorkDocuments;

window.openBureauWorkDocument =
  openBureauWorkDocument;

window.addBureauWorkAction =
  addBureauWorkAction;

window.saveBureauWorkAction =
  saveBureauWorkAction;

window.editBureauWorkDocument =
  editBureauWorkDocument;

window.saveEditedBureauWorkDocument =
  saveEditedBureauWorkDocument;

window.deleteBureauWorkDocument =
  deleteBureauWorkDocument;

window.toggleBureauWorkAction =
  toggleBureauWorkAction;

window.editBureauWorkAction =
  editBureauWorkAction;

window.saveEditedBureauWorkAction =
  saveEditedBureauWorkAction;

window.deleteBureauWorkAction =
  deleteBureauWorkAction;

window.printBureauWorkDocument =
  printBureauWorkDocument;

async function saveBureauWorkAction(
  documentId,
  selectedMemberId
) {

  if (
    !member ||
    (
      member.bureau_member !== true &&
      member.role !== 'admin'
    )
  ) {

    alert(
      '❌ Cette fonctionnalité est réservée aux membres du bureau.'
    );

    return;
  }


  const action =
    document
      .getElementById('bureauWorkActionText')
      ?.value
      ?.trim();


  if (!action) {

    alert(
      "⚠️ Veuillez renseigner l'action."
    );

    return;
  }


  // =====================================================
  // 👑 ADMIN → membre sélectionné
  // 👤 USER → lui-même
  // =====================================================

  const memberId =
    member.role === 'admin'
      ? selectedMemberId
      : member.id;


  if (!memberId) {

    alert(
      '⚠️ Veuillez sélectionner un membre du bureau.'
    );

    return;
  }


  try {

    const { data, error } =
      await db
        .from('bureau_work_actions')
        .insert({

          document_id:
            documentId,

          member_id:
            memberId,

          action:
            action,

          status:
            'a_faire'

        })
        .select()
        .maybeSingle();


    if (error) {

      console.error(
        'ERREUR AJOUT ACTION BUREAU :',
        error
      );

      alert(
        '❌ Impossible d’ajouter l’action.\n\n' +
        (
          error.message ||
          'Erreur inconnue'
        )
      );

      return;
    }


    console.log(
      'ACTION CRÉÉE :',
      data
    );


    closeModal();


    await openBureauWorkDocument(
      documentId
    );


  } catch (error) {

    console.error(
      'ERREUR SAVE BUREAU WORK ACTION :',
      error
    );

    alert(
      '❌ Une erreur est survenue lors de l’ajout.\n\n' +
      (
        error.message ||
        'Erreur inconnue'
      )
    );

  }

}


window.addBureauWorkAction =
  addBureauWorkAction;

window.saveBureauWorkAction =
  saveBureauWorkAction;


// =========================================================
// ✏️ MODIFIER UN DOCUMENT
// =========================================================





async function loadAdminWorkDocumentsHome(){

  if(!member || member.role !== 'admin'){
    return;
  }

  const container =
    document.getElementById('adminWorkDocumentsList');

  if(!container){
    return;
  }

  try{

    const { data, error } = await db
      .from('bureau_work_documents')
      .select('*')
      .order('created_at', {
        ascending:false
      });

    if(error){

      console.error(
        'ERREUR CHARGEMENT DOCUMENTS ACCUEIL :',
        error
      );

      container.innerHTML = `
        <p class="error">
          ❌ Impossible de charger les documents.
        </p>
      `;

      return;
    }

    const documents = data || [];


    if(!documents.length){

      container.innerHTML = `
        <p class="muted">
          📭 Aucun document de travail créé.
        </p>
      `;

      return;
    }


    container.innerHTML = documents.map(d => `

      <div
        style="
          padding:12px 15px;
          margin-top:8px;
          border:1px solid #ddd;
          border-radius:8px;
          background:#fafafa;
        "
      >

        <strong>
          📄 ${esc(d.title || 'Document sans titre')}
        </strong>

        ${
          d.description
            ? `
              <p
                class="muted"
                style="
                  margin:5px 0 0 0;
                "
              >
                ${esc(d.description)}
              </p>
            `
            : ''
        }

      </div>

    `).join('');


  }catch(error){

    console.error(
      'ERREUR LOAD ADMIN WORK DOCUMENTS HOME :',
      error
    );

    container.innerHTML = `
      <p class="error">
        ❌ Une erreur est survenue.
      </p>
    `;

  }

}

window.loadAdminWorkDocumentsHome =
  loadAdminWorkDocumentsHome;


async function showMemberList(type){

  if(!member || member.role !== 'admin'){
    alert('Accès réservé à l’administrateur.');
    return;
  }

  const isAdmin = type === 'admin';

  try{

    const { data, error } = await db
      .from('members')
      .select('*')
      .order('last_name', { ascending:true });

    if(error){
      console.error('ERREUR CHARGEMENT MEMBRES :', error);
      alert('Impossible de charger les membres.');
      return;
    }

    const list = (data || []).filter(m =>
      isAdmin
        ? m.role === 'admin'
        : m.role !== 'admin'
    );

    const title = isAdmin
      ? '👑 Administrateurs'
      : '👥 Utilisateurs';

    let rows = '';

    if(!list.length){

      rows = `
        <tr>
          <td
            colspan="5"
            style="
              text-align:center;
              padding:25px;
            "
          >
            Aucun membre dans cette catégorie.
          </td>
        </tr>
      `;

    }else{

      rows = list.map(m => {

        const nom =
          `${m.first_name || ''} ${m.last_name || ''}`.trim()
          || 'Sans nom';

        const fonction =
          m.function ||
          m.fonction ||
          '—';

        return `
          <tr>

            <td>
              <strong>${esc(nom)}</strong>
            </td>

            <td>
              ${esc(fonction)}
            </td>

            <td>
              ${
                m.role === 'admin'
                  ? 'Administrateur'
                  : 'Utilisateur'
              }
            </td>

            <td>
              ${
                m.active
                  ? '🟢 Actif'
                  : '🔴 Inactif'
              }
            </td>

            <td>

             <div
  class="row"
  style="
    gap:6px;
    flex-wrap:wrap;
  "
>

  <button
    type="button"
    class="ghost"
    onclick="viewMember('${m.id}')"
  >
    👁️ Consulter
  </button>

  <button
    type="button"
    class="ghost"
    onclick="editMember('${m.id}')"
  >
    ✏️ Modifier
  </button>

  <button
    type="button"
    class="ghost"
    onclick="changeCode('${m.id}')"
  >
    🔑 Code
  </button>

  <button
    type="button"
    class="ghost"
    onclick="toggleMember('${m.id}', ${!m.active})"
  >
    ${
      m.active
        ? '⛔ Désactiver'
        : '✅ Activer'
    }
  </button>

  <button
    type="button"
    class="ghost"
    style="color:#b00000;"
    onclick="deleteMember('${m.id}')"
  >
    🗑️ Supprimer
  </button>

</div>

            </td>

          </tr>
        `;

      }).join('');

    }

openModal(`

  <div
    class="row"
    style="
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px;
      gap:10px;
    "
  >

    <h2 style="margin:0;">
      ${title}
    </h2>

    <button
      type="button"
      class="primary"
      onclick="newMember()"
    >
      ➕ Ajouter un membre
    </button>

  </div>

  <p class="muted">
    ${list.length}
    membre${list.length > 1 ? 's' : ''}
  </p>

      <div
        class="table-wrap"
        style="
          margin-top:15px;
          overflow-x:auto;
        "
      >

        <table class="table">

          <thead>
            <tr>
              <th>Nom</th>
              <th>Fonction</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>

      <div
        class="row"
        style="
          margin-top:18px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR SHOW MEMBER LIST :',
      error
    );

    alert(
      error.message ||
      'Impossible d’afficher les membres.'
    );

  }
}

/* =====================================================
   CONSULTATION D'UN MEMBRE
   ===================================================== */

/* =====================================================
   👤 CONSULTATION / FICHE D'UN MEMBRE
   ===================================================== */

async function viewMember(id){

  try{

    // ====================================================
    // 🔐 Vérification administrateur
    // ====================================================

    if(!member || member.role !== 'admin'){

      alert(
        'Accès réservé à l’administrateur.'
      );

      return;

    }


    // ====================================================
    // 👤 Récupération du membre
    // ====================================================

    const { data:m, error } =

      await db
        .from('members')
        .select('*')
        .eq('id', id)
        .maybeSingle();


    if(error){

      console.error(
        'ERREUR CHARGEMENT MEMBRE :',
        error
      );

      throw error;

    }


    if(!m){

      alert(
        'Membre introuvable.'
      );

      return;

    }


    // ====================================================
    // 👶 Récupération des enfants
    // ====================================================

    const {
      data:children,
      error:childrenError
    } =

      await db
        .from('member_children')
        .select('*')
        .eq('member_id', id)
        .order(
          'birth_date',
          {
            ascending:true
          }
        );


    if(childrenError){

      console.error(
        'ERREUR ENFANTS :',
        childrenError
      );

      throw childrenError;

    }


    // ====================================================
    // ⏸️ Récupération des périodes d'inactivité
    // ====================================================

    const {
      data:inactivities,
      error:inactivityError
    } =

      await db
        .from('member_inactivity')
        .select('*')
        .eq('member_id', id)
        .order(
          'start_date',
          {
            ascending:true
          }
        );


    if(inactivityError){

      console.error(
        'ERREUR INACTIVITÉ :',
        inactivityError
      );

      throw inactivityError;

    }


    const enfants =
      children || [];

    const periodes =
      inactivities || [];


    // ====================================================
    // 👤 NOM COMPLET
    // ====================================================

    const fullName =

      `${m.first_name || ''} ${
        m.last_name || ''
      }`.trim()

      || 'Membre sans nom';


    // ====================================================
    // ⚧️ SEXE
    // ====================================================

    const sexe =

      m.gender === 'homme'

        ? '👨 Homme'

        : m.gender === 'femme'

          ? '👩 Femme'

          : '—';


    // ====================================================
    // 🟢 STATUT
    // ====================================================

    const statut =

      m.status === 'actif'

        ? '🟢 Actif'

        : m.status === 'retraite'

          ? '⚪ Retraité'

          : m.status

            ? esc(m.status)

            : '—';


    // ====================================================
    // 📅 DATE DE NAISSANCE
    // ====================================================

    const birthDate =

      m.birth_date

        ? fmtDate(
            m.birth_date
          )

        : '—';


    // ====================================================
    // 🚒 DATE D'ENTRÉE SP
    // ====================================================

    const spEntryDate =

      m.sp_entry_date

        ? fmtDate(
            m.sp_entry_date
          )

        : '—';


    // ====================================================
    // ⏱️ CALCUL DE L'ANCIENNETÉ
    // ====================================================

    let seniorityText =
      '—';


    if(m.sp_entry_date){

      const start =
        new Date(
          m.sp_entry_date +
          'T00:00:00'
        );

      const today =
        new Date();


      let years =
        today.getFullYear() -
        start.getFullYear();

      let months =
        today.getMonth() -
        start.getMonth();


      if(
        today.getDate() <
        start.getDate()
      ){

        months--;

      }


      if(months < 0){

        years--;

        months += 12;

      }


      if(years < 0){

        years = 0;

        months = 0;

      }


      seniorityText =

        `${years} an${
          years > 1 ? 's' : ''
        }`;

      if(months > 0){

        seniorityText +=

          ` ${months} mois`;

      }

    }


    // ====================================================
    // 🏛️ BUREAU
    // ====================================================

    const bureau =

      m.bureau_member === true

        ? '✅ Oui'

        : '❌ Non';


    // ====================================================
    // 👨‍🚒 ANCIEN JSP
    // ====================================================

    const ancienJsp =

      m.was_jsp === true

        ? '✅ Oui'

        : '❌ Non';


    // ====================================================
    // 👶 NOMBRE D'ENFANTS
    // ====================================================

    const childrenCount =

      m.children_count != null

        ? m.children_count

        : enfants.length;


    // ====================================================
    // 🖨️ FICHE IMPRIMABLE
    // ====================================================

    const profileContent = `

      <div
        id="memberProfilePrint"
        style="
          max-width:900px;
          margin:auto;
        "
      >

        <!-- ==============================================
             EN-TÊTE
        =============================================== -->

        <div
          style="
            text-align:center;
            margin-bottom:20px;
          "
        >

          <div
            style="
              font-size:42px;
              margin-bottom:8px;
            "
          >
            👤
          </div>


          <h2
            style="
              margin:0;
            "
          >
            ${esc(fullName)}
          </h2>


          <p
            class="muted"
            style="
              margin:6px 0 0;
            "
          >
            ${statut}
          </p>

        </div>


        <!-- ==============================================
             👤 INFORMATIONS PERSONNELLES
        =============================================== -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            👤 Informations personnelles
          </h3>


          <p>

            <strong>
              Prénom :
            </strong>

            ${esc(
              m.first_name || '—'
            )}

          </p>


          <p>

            <strong>
              Nom :
            </strong>

            ${esc(
              m.last_name || '—'
            )}

          </p>


          <p>

            <strong>
              Date de naissance :
            </strong>

            ${birthDate}

          </p>


          <p>

            <strong>
              Sexe :
            </strong>

            ${sexe}

          </p>

        </div>


        <!-- ==============================================
             🚒 PARCOURS SP
        =============================================== -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            🚒 Parcours sapeur-pompier
          </h3>


          <p>

            <strong>
              Date d'entrée chez les SP :
            </strong>

            ${spEntryDate}

          </p>


          <p>

            <strong>
              Ancienneté :
            </strong>

            ${seniorityText}

          </p>


          <p>

            <strong>
              Statut :
            </strong>

            ${statut}

          </p>


          <p>

            <strong>
              Ancien JSP :
            </strong>

            ${ancienJsp}

          </p>


          <p>

            <strong>
              Membre du bureau :
            </strong>

            ${bureau}

          </p>

        </div>


        <!-- ==============================================
             ⏸️ INACTIVITÉS
        =============================================== -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            ⏸️ Périodes d'inactivité
          </h3>


          ${
            periodes.length

              ?

                periodes
                  .map(
                    p => `

                      <div
                        style="
                          padding:10px 0;
                          border-top:
                            1px solid #e5e7eb;
                        "
                      >

                        <p>

                          <strong>
                            Début :
                          </strong>

                          ${
                            p.start_date
                              ? fmtDate(
                                  p.start_date
                                )
                              : '—'
                          }

                        </p>


                        <p>

                          <strong>
                            Fin :
                          </strong>

                          ${
                            p.end_date
                              ? fmtDate(
                                  p.end_date
                                )
                              : 'En cours'
                          }

                        </p>

                      </div>

                    `
                  )
                  .join('')


              : `

                  <p class="muted">

                    Aucune période
                    d'inactivité renseignée.

                  </p>

                `
          }

        </div>


        <!-- ==============================================
             👨‍👩‍👧‍👦 FAMILLE
        =============================================== -->

        <div
          class="card"
          style="
            margin-top:12px;
          "
        >

          <h3>
            👨‍👩‍👧‍👦 Famille
          </h3>


          <p>

            <strong>
              Nombre d'enfants :
            </strong>

            ${childrenCount}

          </p>


          ${
            enfants.length

              ?

                enfants
                  .map(
                    (child,index) => `

                      <div
                        style="
                          padding:12px 0;
                          border-top:
                            1px solid #e5e7eb;
                        "
                      >

                        <h4
                          style="
                            margin:
                              0 0 8px 0;
                          "
                        >

                          👶 Enfant
                          ${index + 1}

                        </h4>


                        <p>

                          <strong>
                            Prénom :
                          </strong>

                          ${esc(
                            child.first_name ||
                            '—'
                          )}

                        </p>


                        <p>

                          <strong>
                            Nom :
                          </strong>

                          ${esc(
                            child.last_name ||
                            '—'
                          )}

                        </p>


                        <p>

                          <strong>
                            Sexe :
                          </strong>

                          ${
                            child.gender ===
                            'fille'

                              ? '👧 Fille'

                              : child.gender ===
                                'garcon'

                                ? '👦 Garçon'

                                : '—'
                          }

                        </p>


                        <p>

                          <strong>
                            Date de naissance :
                          </strong>

                          ${
                            child.birth_date
                              ? fmtDate(
                                  child.birth_date
                                )
                              : '—'
                          }

                        </p>

                      </div>

                    `
                  )
                  .join('')


              : ''

          }

        </div>


      </div>

    `;


    // ====================================================
    // 🪟 POPUP
    // ====================================================

    openModal(`

      ${profileContent}


      <div
        class="row"
        style="
          margin-top:20px;
          gap:10px;
          justify-content:flex-end;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="
            printMemberProfile(
              '${m.id}'
            )
          "
        >

          🖨️ Imprimer

        </button>


        <button
          type="button"
          class="primary"
          onclick="
            editMember(
              '${m.id}'
            )
          "
        >

          ✏️ Modifier

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR CONSULTATION MEMBRE :',
      error
    );


    alert(
      error?.message ||
      'Impossible de consulter le membre.'
    );

  }

}





window.viewMember =
  viewMember;


window.printMemberProfile =
  printMemberProfile;

// ==========================================================
// 🗣️ GESTION DES SUJETS À ABORDER EN RÉUNION
// ==========================================================


async function showAdminMeetingSubjects(){

  try{

    // Vérification administrateur
    if(!member || member.role !== 'admin'){
      alert('❌ Accès réservé à l’administrateur.');
      return;
    }

    // Chargement des sujets
    const { data, error } = await db
      .from('meeting_subjects')
      .select(`
        *,
        members (
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending:false });

    if(error){
      console.error('ERREUR CHARGEMENT SUJETS RÉUNION :', error);
      alert('❌ Impossible de charger les sujets.');
      return;
    }

    const subjects = data || [];

    // Aucun sujet
    if(!subjects.length){
      openAdminPopup(
        '🗣️ Sujets à aborder en réunion',
        `
          <div class="card" style="text-align:center;padding:20px;">
            <p class="muted">Aucun sujet proposé pour le moment.</p>
          </div>
        `
      );
      return;
    }

    // Affichage des sujets
    const html = subjects.map(subject => {

      const author = subject.members
        ? `${subject.members.first_name || ''} ${subject.members.last_name || ''}`.trim()
        : 'Membre inconnu';

      const status = subject.status || 'a_aborder';

      const statusHtml = status === 'traite'
        ? '<span class="pill">✅ Traité</span>'
        : '<span class="pill">🟠 À aborder</span>';

      return `
        <div class="card" style="margin-top:10px;border:1px solid #e5e7eb;">

          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
            <div>
              <h4 style="margin:0 0 5px;">
                🗣️ ${esc(subject.title || 'Sujet sans titre')}
              </h4>

              <div class="muted" style="font-size:13px;">
                👤 ${esc(author)}
                ${subject.created_at ? ` · 📅 ${fmtDate(subject.created_at)}` : ''}
              </div>
            </div>

            <div>${statusHtml}</div>
          </div>

          ${
            subject.description
              ? `<p style="margin-top:12px;white-space:pre-wrap;">${esc(subject.description)}</p>`
              : ''
          }

          <div class="row" style="margin-top:15px;gap:8px;flex-wrap:wrap;">

            ${
              status !== 'traite'
                ? `
                  <button
                    type="button"
                    class="primary"
                    onclick="markMeetingSubjectDone('${subject.id}')">
                    ✅ Marquer comme traité
                  </button>
                `
                : `
                  <button
                    type="button"
                    class="ghost"
                    onclick="reopenMeetingSubject('${subject.id}')">
                    🔄 Remettre à aborder
                  </button>
                `
            }

            <button
              type="button"
              class="ghost"
              style="color:#b00000;"
              onclick="deleteMeetingSubject('${subject.id}')">
              🗑️ Supprimer
            </button>

          </div>
        </div>
      `;
    }).join('');

    openAdminPopup(
      '🗣️ Sujets à aborder en réunion',
      html
    );

  }catch(error){

    console.error('ERREUR SHOW ADMIN MEETING SUBJECTS :', error);

    alert(
      error?.message ||
      '❌ Impossible d’afficher les sujets.'
    );

  }

}

window.showAdminMeetingSubjects = showAdminMeetingSubjects;


// ==========================================================
// ✅ MARQUER UN SUJET COMME TRAITÉ
// ==========================================================

async function markMeetingSubjectDone(id){

  try{

    if(!member || member.role !== 'admin'){
      alert('❌ Accès réservé à l’administrateur.');
      return;
    }

    const { error } = await db
      .from('meeting_subjects')
      .update({
        status: 'traite'
      })
      .eq('id', id);

    if(error){

      console.error(
        'ERREUR STATUT SUJET :',
        error
      );

      alert(
        '❌ Impossible de modifier le statut du sujet.'
      );

      return;

    }

    await showAdminMeetingSubjects();

  }catch(error){

    console.error(
      'ERREUR MARK MEETING SUBJECT DONE :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


window.markMeetingSubjectDone =
  markMeetingSubjectDone;


// ==========================================================
// 🔄 REMETTRE UN SUJET À ABORDER
// ==========================================================

async function reopenMeetingSubject(id){

  try{

    if(!member || member.role !== 'admin'){
      alert('❌ Accès réservé à l’administrateur.');
      return;
    }

    const { error } = await db
      .from('meeting_subjects')
      .update({
        status: 'a_aborder'
      })
      .eq('id', id);

    if(error){

      console.error(
        'ERREUR RÉOUVERTURE SUJET :',
        error
      );

      alert(
        '❌ Impossible de remettre le sujet à aborder.'
      );

      return;

    }

    await showAdminMeetingSubjects();

  }catch(error){

    console.error(
      'ERREUR REOPEN MEETING SUBJECT :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


window.reopenMeetingSubject =
  reopenMeetingSubject;


// ==========================================================
// 🗑️ SUPPRIMER UN SUJET
// ==========================================================

async function deleteMeetingSubject(id){

  try{

    if(!member || member.role !== 'admin'){
      alert('❌ Accès réservé à l’administrateur.');
      return;
    }


    const confirmation =
      confirm(
        '⚠️ Voulez-vous vraiment supprimer ce sujet ?\n\n' +
        'Cette action est définitive.'
      );


    if(!confirmation){
      return;
    }


    const { error } = await db
      .from('meeting_subjects')
      .delete()
      .eq('id', id);


    if(error){

      console.error(
        'ERREUR SUPPRESSION SUJET :',
        error
      );

      alert(
        '❌ Impossible de supprimer le sujet.'
      );

      return;

    }


    await showAdminMeetingSubjects();


  }catch(error){

    console.error(
      'ERREUR DELETE MEETING SUBJECT :',
      error
    );

    alert(
      '❌ Une erreur est survenue.'
    );

  }

}


window.deleteMeetingSubject =
  deleteMeetingSubject;



/* =====================================================
   MODIFICATION D'UN MEMBRE
   ===================================================== */

async function editMember(id){

  try{

    if(!member || member.role !== 'admin'){
      alert('Accès réservé à l’administrateur.');
      return;
    }


    const { data:m, error } = await db
      .from('members')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if(error) throw error;

    if(!m){
      alert('Membre introuvable.');
      return;
    }


    const { data:children, error:childrenError } = await db
      .from('member_children')
      .select('*')
      .eq('member_id', id)
      .order('birth_date', {ascending:true});

    if(childrenError) throw childrenError;


    const { data:inactivities, error:inactivityError } = await db
      .from('member_inactivity')
      .select('*')
      .eq('member_id', id)
      .order('start_date', {ascending:true});

    if(inactivityError) throw inactivityError;


    const childList = children || [];
    const inactivityList = inactivities || [];


    openModal(`

      <h2>
        ✏️ Modifier le membre
      </h2>


      <!-- IDENTITÉ -->

      <h3 style="margin-top:20px;">
        👤 Informations personnelles
      </h3>

      <div class="form-grid">

        <div>

          <label>Prénom *</label>

          <input
            id="editMemberFirstName"
            class="input"
            type="text"
            value="${esc(m.first_name || '')}"
          >

        </div>


        <div>

          <label>Nom *</label>

          <input
            id="editMemberLastName"
            class="input"
            type="text"
            value="${esc(m.last_name || '')}"
          >

        </div>


        <div>

          <label>Date de naissance</label>

          <input
            id="editMemberBirthDate"
            class="input"
            type="date"
            value="${m.birth_date || ''}"
          >

        </div>


        <div>

          <label>Sexe</label>

          <select
            id="editMemberGender"
            class="select"
          >

            <option value="">-- Choisir --</option>

            <option
              value="homme"
              ${m.gender === 'homme' ? 'selected' : ''}
            >
              Homme
            </option>

            <option
              value="femme"
              ${m.gender === 'femme' ? 'selected' : ''}
            >
              Femme
            </option>

          </select>

        </div>

      </div>


      <!-- PARCOURS SP -->

      <h3 style="margin-top:25px;">
        🚒 Parcours sapeur-pompier
      </h3>

      <div class="form-grid">

        <div>

          <label>Date d'entrée chez les SP</label>

          <input
            id="editMemberSpEntryDate"
            class="input"
            type="date"
            value="${m.sp_entry_date || ''}"
          >

        </div>


        <div>

          <label>Statut</label>

          <select
            id="editMemberStatus"
            class="select"
          >

            <option
              value="actif"
              ${m.status === 'actif' ? 'selected' : ''}
            >
              🟢 Actif
            </option>

            <option
              value="retraite"
              ${m.status === 'retraite' ? 'selected' : ''}
            >
              ⚪ Retraité
            </option>

          </select>

        </div>


        <div>

          <label>Ancien JSP ?</label>

          <select
            id="editMemberWasJsp"
            class="select"
          >

            <option
              value="false"
              ${!m.was_jsp ? 'selected' : ''}
            >
              Non
            </option>

            <option
              value="true"
              ${m.was_jsp ? 'selected' : ''}
            >
              Oui
            </option>

          </select>

        </div>


        <div>

          <label>Membre du bureau ?</label>

          <select
            id="editMemberBureau"
            class="select"
          >

            <option
              value="false"
              ${!m.bureau_member ? 'selected' : ''}
            >
              Non
            </option>

            <option
              value="true"
              ${m.bureau_member ? 'selected' : ''}
            >
              Oui
            </option>

          </select>

        </div>

      </div>


      <!-- ENFANTS -->

      <h3 style="margin-top:25px;">
        👨‍👩‍👧‍👦 Enfants
      </h3>

      <div class="field">

        <label>Nombre d'enfants</label>

        <input
          id="editMemberChildrenCount"
          class="input"
          type="number"
          min="0"
          value="${childList.length}"
        >

      </div>


      <div id="editChildrenContainer">

        ${
          childList.map((child,index) => `

            <div
              class="card edit-child"
              style="margin-top:10px;"
            >

              <h4>
                👶 Enfant ${index + 1}
              </h4>

              <div class="form-grid">

                <div>

                  <label>Prénom</label>

                  <input
                    class="input edit-child-first-name"
                    type="text"
                    value="${esc(child.first_name || '')}"
                  >

                </div>


                <div>

                  <label>Nom</label>

                  <input
                    class="input edit-child-last-name"
                    type="text"
                    value="${esc(child.last_name || '')}"
                  >

                </div>


                <div>

                  <label>Fille / Garçon</label>

                  <select
                    class="select edit-child-gender"
                  >

                    <option value="">
                      -- Choisir --
                    </option>

                    <option
                      value="fille"
                      ${child.gender === 'fille' ? 'selected' : ''}
                    >
                      👧 Fille
                    </option>

                    <option
                      value="garcon"
                      ${child.gender === 'garcon' ? 'selected' : ''}
                    >
                      👦 Garçon
                    </option>

                  </select>

                </div>


                <div>

                  <label>Date de naissance</label>

                  <input
                    class="input edit-child-birth-date"
                    type="date"
                    value="${child.birth_date || ''}"
                  >

                </div>

              </div>

            </div>

          `).join('')
        }

      </div>

<button
  type="button"
  class="ghost"
  onclick="addEditMemberChild()"
  style="margin-top:8px;"
>
  ➕ Ajouter un enfant
</button>


      <!-- INACTIVITÉ -->

      <h3 style="margin-top:25px;">
        ⏸️ Périodes d'inactivité
      </h3>

      <div id="editInactivityContainer">

        ${
          inactivityList.map(p => `

            <div
              class="card edit-inactivity"
              style="margin-top:10px;"
            >

              <div class="form-grid">

                <div>

                  <label>Début</label>

                  <input
                    class="input edit-inactivity-start"
                    type="date"
                    value="${p.start_date || ''}"
                  >

                </div>


                <div>

                  <label>Fin</label>

                  <input
                    class="input edit-inactivity-end"
                    type="date"
                    value="${p.end_date || ''}"
                  >

                </div>

              </div>


              <button
                type="button"
                class="ghost"
                onclick="this.parentElement.remove()"
                style="margin-top:8px;"
              >
                🗑️ Supprimer cette période
              </button>

            </div>

          `).join('')
        }

      </div>


      <button
        type="button"
        class="ghost"
        onclick="addEditMemberInactivity()"
        style="margin-top:8px;"
      >
        ➕ Ajouter une période d'inactivité
      </button>


      <!-- COMPTE -->

      <h3 style="margin-top:25px;">
        🔐 Compte
      </h3>

      <div class="field">

        <label>Rôle</label>

        <select
          id="editMemberRole"
          class="select"
        >

          <option
            value="user"
            ${m.role !== 'admin' ? 'selected' : ''}
          >
            Utilisateur
          </option>

          <option
            value="admin"
            ${m.role === 'admin' ? 'selected' : ''}
          >
            Administrateur
          </option>

        </select>

      </div>


      <div
        class="row"
        style="margin-top:25px;"
      >

        <button
          type="button"
          class="primary"
          onclick="saveMemberEdit('${id}')"
        >
          💾 Enregistrer les modifications
        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >
          Annuler
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR MODIFICATION MEMBRE :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger le membre.'
    );

  }

}

/* =====================================================
   AJOUT D'UN ENFANT EN MODIFICATION
   ===================================================== */

function addEditMemberChild(){

  const container =
    $('editChildrenContainer');

  const countInput =
    $('editMemberChildrenCount');

  if(!container || !countInput){
    return;
  }

  const currentCount =
    container.querySelectorAll('.edit-child').length;

  const newIndex =
    currentCount + 1;

  const div =
    document.createElement('div');

  div.className = 'card edit-child';

  div.style.marginTop = '10px';

  div.innerHTML = `

    <h4>
      👶 Enfant ${newIndex}
    </h4>

    <div class="form-grid">

      <div>

        <label>Prénom</label>

        <input
          class="input edit-child-first-name"
          type="text">

      </div>


      <div>

        <label>Nom</label>

        <input
          class="input edit-child-last-name"
          type="text">

      </div>


      <div>

        <label>Fille / Garçon</label>

        <select
          class="select edit-child-gender">

          <option value="">
            -- Choisir --
          </option>

          <option value="fille">
            👧 Fille
          </option>

          <option value="garcon">
            👦 Garçon
          </option>

        </select>

      </div>


      <div>

        <label>Date de naissance</label>

        <input
          class="input edit-child-birth-date"
          type="date">

      </div>

    </div>


    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove(); updateEditChildrenCount();"
      style="margin-top:8px;">

      🗑️ Supprimer cet enfant

    </button>

  `;

  container.appendChild(div);

  countInput.value =
    container.querySelectorAll('.edit-child').length;

}


/* =====================================================
   MISE À JOUR DU NOMBRE D'ENFANTS
   ===================================================== */

function updateEditChildrenCount(){

  const container =
    $('editChildrenContainer');

  const countInput =
    $('editMemberChildrenCount');

  if(!container || !countInput){
    return;
  }

  countInput.value =
    container.querySelectorAll('.edit-child').length;

}

function addEditMemberInactivity(){

  const container =
    $('editInactivityContainer');

  if(!container){
    console.error(
      'editInactivityContainer introuvable'
    );
    return;
  }

  const index =
    container.querySelectorAll(
      '.edit-inactivity'
    ).length + 1;

  const div =
    document.createElement('div');

  div.className =
    'card edit-inactivity';

  div.style.marginTop =
    '10px';

  div.innerHTML = `

    <h4>
      ⏸️ Période d'inactivité ${index}
    </h4>

    <div class="form-grid">

      <div>

        <label>Début</label>

        <input
          class="input edit-inactivity-start"
          type="date"
        >

      </div>


      <div>

        <label>Fin</label>

        <input
          class="input edit-inactivity-end"
          type="date"
        >

      </div>

    </div>


    <button
      type="button"
      class="ghost"
      onclick="this.parentElement.remove()"
      style="margin-top:8px;"
    >

      🗑️ Supprimer cette période

    </button>

  `;

  container.appendChild(div);

}

/* =====================================================
   ENREGISTREMENT MODIFICATION MEMBRE
   ===================================================== */

async function saveMemberEdit(id){

  console.log('ID MEMBRE À MODIFIER =', id);
console.log('TYPE ID =', typeof id);
console.log('MEMBRE ACTUEL =', member);

  try{

    if(!member || String(member.role).toLowerCase() !== 'admin'){
      alert('Accès réservé à l’administrateur.');
      return;
    }

    const firstName =
      $('editMemberFirstName')?.value.trim() || '';

    const lastName =
      $('editMemberLastName')?.value.trim() || '';

    const birthDate =
      $('editMemberBirthDate')?.value || null;

    const gender =
      $('editMemberGender')?.value || null;

    const spEntryDate =
      $('editMemberSpEntryDate')?.value || null;

    const status =
      $('editMemberStatus')?.value || 'actif';

    const wasJsp =
      $('editMemberWasJsp')?.value === 'true';

    const bureauMember =
      $('editMemberBureau')?.value === 'true';

    const childrenCount =
      Number($('editMemberChildrenCount')?.value || 0);

    const role =
      $('editMemberRole')?.value || 'user';


    if(!firstName || !lastName){

      alert('Le prénom et le nom sont obligatoires.');
      return;

    }


    /* =====================================================
       1. MODIFICATION DU MEMBRE
       ===================================================== */

  const { error: memberError } = await db
  .from('members')
  .update({
    first_name: firstName,
    last_name: lastName,
    birth_date: birthDate,
    gender: gender,
    sp_entry_date: spEntryDate,
    status: status,
    was_jsp: wasJsp,
    bureau_member: bureauMember,
    children_count: childrenCount,
    role: role
  })
  .eq('id', id);

if(memberError){
  throw memberError;
}

console.log('✅ MEMBRE MODIFIÉ :', id);

    /* =====================================================
       2. ENFANTS
       ===================================================== */

    const { error:deleteChildrenError } =
      await db
        .from('member_children')
        .delete()
        .eq('member_id', id);


    if(deleteChildrenError){
      throw deleteChildrenError;
    }


    const childBlocks = [
      ...document.querySelectorAll(
        '#editChildrenContainer .edit-child'
      )
    ];


    const childrenToInsert = [];


    childBlocks.forEach(block => {

      const first =
        block
          .querySelector('.edit-child-first-name')
          ?.value.trim() || '';

      const last =
        block
          .querySelector('.edit-child-last-name')
          ?.value.trim() || '';

      const childGender =
        block
          .querySelector('.edit-child-gender')
          ?.value || null;

      const birth =
        block
          .querySelector('.edit-child-birth-date')
          ?.value || null;


      if(first){

        childrenToInsert.push({

          member_id: id,
          first_name: first,
          last_name: last || null,
          gender: childGender,
          birth_date: birth

        });

      }

    });


    if(childrenToInsert.length){

      const { error:childrenError } =
        await db
          .from('member_children')
          .insert(childrenToInsert);


      if(childrenError){
        throw childrenError;
      }

    }


    /* =====================================================
       3. PÉRIODES D'INACTIVITÉ
       ===================================================== */

    const { error:deleteInactivityError } =
      await db
        .from('member_inactivity')
        .delete()
        .eq('member_id', id);


    if(deleteInactivityError){
      throw deleteInactivityError;
    }


    const inactivityBlocks = [
      ...document.querySelectorAll(
        '#editInactivityContainer .edit-inactivity'
      )
    ];


    const inactivityToInsert = [];


    inactivityBlocks.forEach(block => {

      const start =
        block
          .querySelector('.edit-inactivity-start')
          ?.value || '';

      const end =
        block
          .querySelector('.edit-inactivity-end')
          ?.value || null;


      if(start){

        if(end && end < start){

          throw new Error(
            'Une date de fin d’inactivité est antérieure à sa date de début.'
          );

        }


        inactivityToInsert.push({

          member_id: id,
          start_date: start,
          end_date: end

        });

      }

    });


    if(inactivityToInsert.length){

      const { error:inactivityError } =
        await db
          .from('member_inactivity')
          .insert(inactivityToInsert);


      if(inactivityError){
        throw inactivityError;
      }

    }


    /* =====================================================
       4. FIN
       ===================================================== */

    closeModal();

    alert(
      '✅ Les informations du membre ont bien été enregistrées.'
    );

    await renderAdmin();


  }catch(error){

    console.error(
      'ERREUR MODIFICATION MEMBRE :',
      error
    );

    alert(
      error.message ||
      'Impossible d’enregistrer les modifications.'
    );

  }

}

// ============================================================
// 📋 COMPTES RENDUS DE RÉUNION
// ============================================================


// ============================================================
// ➕ AJOUTER UN COMPTE RENDU
// ============================================================

function addMeetingReport(){

  let topics = [];


  // ==========================================================
  // 💾 SAUVEGARDER LES SAISIES ACTUELLES
  // ==========================================================

  function saveCurrentTopics(){

    topics.forEach((topic,index) => {

      const topicInput =
        document.getElementById(
          `meetingTopic_${index}`
        );

      const contentInput =
        document.getElementById(
          `meetingContent_${index}`
        );


      if(topicInput){

        topic.topic =
          topicInput.value;

      }


      if(contentInput){

        topic.content =
          contentInput.value;

      }

    });

  }


  // ==========================================================
  // 📌 AFFICHER LES THÈMES
  // ==========================================================

  function renderTopics(){

    return topics.map((topic,index) => `

      <div
        class="card"
        style="
          margin-top:12px;
          padding:15px;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
          "
        >

          <h4 style="margin:0;">

            📌 Thème ${index + 1}

          </h4>


          ${
            topics.length > 1

            ? `

              <button
                type="button"
                class="danger"
                onclick="
                  removeMeetingTopic(${index});
                "
              >

                🗑️

              </button>

            `

            : ''

          }

        </div>


        <label
          style="
            display:block;
            margin-top:12px;
          "
        >

          Thème abordé

          <input
            type="text"
            id="meetingTopic_${index}"
            value="${esc(topic.topic || '')}"
            placeholder="Ex : Organisation des manifestations"
          >

        </label>


        <label
          style="
            display:block;
            margin-top:12px;
          "
        >

          Compte rendu du thème

          <textarea
            id="meetingContent_${index}"
            rows="6"
            placeholder="Saisissez ici le compte rendu de ce thème..."
          >${esc(topic.content || '')}</textarea>

        </label>

      </div>

    `).join('');

  }


  // ==========================================================
  // 🔄 RAFRAÎCHIR LES THÈMES
  // ==========================================================

  function refreshMeetingTopics(){

    saveCurrentTopics();


    const container =
      $('meetingTopicsContainer');


    if(!container) return;


    container.innerHTML =
      renderTopics();

  }


  // ==========================================================
  // ➕ AJOUTER UN THÈME
  // ==========================================================

  window.addMeetingTopic =
    function(){

      // IMPORTANT :
      // on récupère les saisies AVANT de recréer les champs

      saveCurrentTopics();


      topics.push({

        topic:'',

        content:''

      });


      refreshMeetingTopics();

    };


  // ==========================================================
  // 🗑️ SUPPRIMER UN THÈME
  // ==========================================================

  window.removeMeetingTopic =
    function(index){

      saveCurrentTopics();


      topics.splice(
        index,
        1
      );


      if(!topics.length){

        topics.push({

          topic:'',

          content:''

        });

      }


      refreshMeetingTopics();

    };


  // ==========================================================
  // 📝 PREMIER THÈME
  // ==========================================================

  topics.push({

    topic:'',

    content:''

  });


  // ==========================================================
  // 🪟 POPUP
  // ==========================================================

  openModal(`

    <h2>

      📋 Nouveau compte rendu

    </h2>


    <label>

      Type de réunion

      <select id="meetingType">

        <option value="amicale">

          🔵 Réunion amicale

        </option>


        <option value="assemblee_generale">

          🟣 Assemblée générale

        </option>

      </select>

    </label>


    <label
      style="
        display:block;
        margin-top:12px;
      "
    >

      Date de la réunion

      <input
        type="date"
        id="meetingDate"
      >

    </label>


    <label
      style="
        display:block;
        margin-top:12px;
      "
    >

      Titre de la réunion

      <input
        type="text"
        id="meetingTitle"
        placeholder="Ex : Réunion de septembre"
      >

    </label>


    <h3
      style="
        margin-top:20px;
        margin-bottom:5px;
      "
    >

      📌 Thèmes abordés

    </h3>


    <p class="muted">

      Ajoutez les thèmes abordés puis
      rédigez le compte rendu correspondant.

    </p>


    <div
      id="meetingTopicsContainer"
    >

      ${renderTopics()}

    </div>


    <button
      type="button"
      class="primary"
      style="margin-top:12px;"
      onclick="addMeetingTopic()"
    >

      ➕ Ajouter un thème

    </button>


    <div
      class="row"
      style="
        margin-top:20px;
        gap:10px;
        flex-wrap:wrap;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="saveMeetingReport()"
      >

        💾 Publier le compte rendu

      </button>


      <button
        type="button"
        class="secondary"
        onclick="closeModal()"
      >

        Annuler

      </button>

    </div>

  `);

}


window.addMeetingReport =
  addMeetingReport;


// ============================================================
// 💾 ENREGISTRER UN NOUVEAU COMPTE RENDU
// ============================================================

window.saveMeetingReport =
  async function(){

    const meetingType =
      $('meetingType')?.value;

    const meetingDate =
      $('meetingDate')?.value;

    const title =
      $('meetingTitle')?.value.trim();


    if(!meetingType){

      alert(
        'Veuillez choisir le type de réunion.'
      );

      return;

    }


    if(!meetingDate){

      alert(
        'Veuillez choisir une date.'
      );

      return;

    }


    if(!title){

      alert(
        'Veuillez renseigner le titre.'
      );

      return;

    }


    // ========================================================
    // RÉCUPÉRER LES THÈMES DIRECTEMENT DANS LES CHAMPS
    // ========================================================

    const cards =
      document.querySelectorAll(
        '#meetingTopicsContainer .card'
      );


    const topics = [];


    cards.forEach((card,index) => {

      const topicInput =
        card.querySelector(
          `#meetingTopic_${index}`
        );


      const contentInput =
        card.querySelector(
          `#meetingContent_${index}`
        );


      const topic =
        topicInput?.value.trim() || '';


      const content =
        contentInput?.value.trim() || '';


      if(topic || content){

        topics.push({

          topic:topic,

          content:content,

          topic_order:
            topics.length

        });

      }

    });


    if(!topics.length){

      alert(
        'Veuillez renseigner au moins un thème.'
      );

      return;

    }


    // ========================================================
    // ➕ CRÉER LE COMPTE RENDU
    // ========================================================

    const {data:report,error} =
      await db
        .from('meeting_reports')
        .insert({

          meeting_type:
            meetingType,

          meeting_date:
            meetingDate,

          title:
            title

        })
        .select()
        .single();


    if(error){

      console.error(
        'Erreur création compte rendu :',
        error
      );

      alert(
        '❌ Impossible de créer le compte rendu.'
      );

      return;

    }


    // ========================================================
    // ➕ AJOUTER LES THÈMES
    // ========================================================

    const topicRows =
      topics.map((topic,index) => ({

        report_id:
          report.id,

        topic:
          topic.topic,

        content:
          topic.content,

        topic_order:
          index

      }));


    const {error:topicsError} =
      await db
        .from('meeting_report_topics')
        .insert(topicRows);


    if(topicsError){

      console.error(
        'Erreur ajout thèmes :',
        topicsError
      );


      // On supprime le compte rendu
      // si les thèmes n'ont pas pu être enregistrés

      await db
        .from('meeting_reports')
        .delete()
        .eq(
          'id',
          report.id
        );


      alert(
        '❌ Impossible d’enregistrer les thèmes.'
      );

      return;

    }


    alert(
      '✅ Compte rendu publié avec succès.'
    );


    closeModal();


    await loadAdminMeetingReports();

  };


// ============================================================
// 📋 CHARGEMENT ADMIN
// ============================================================

async function loadAdminMeetingReports(){

  const container =
    $('adminMeetingReportsList');


  if(!container) return;


  const {data:reports,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .order(
        'meeting_date',
        {
          ascending:false
        }
      );


  if(error){

    console.error(
      'Erreur chargement comptes rendus :',
      error
    );


    container.innerHTML = `

      <p style="color:#c1121f;">

        ❌ Impossible de charger
        les comptes rendus.

      </p>

    `;

    return;

  }


  if(!reports || !reports.length){

    container.innerHTML = `

      <div class="card">

        <p class="muted">

          Aucun compte rendu disponible.

        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =

    reports.map(report => {

      const type =

        report.meeting_type ===
        'assemblee_generale'

        ? '🟣 ASSEMBLÉE GÉNÉRALE'

        : '🔵 RÉUNION AMICALE';


      const date =

        report.meeting_date

        ? new Date(
            report.meeting_date +
            'T00:00:00'
          ).toLocaleDateString(
            'fr-FR'
          )

        : 'Date non renseignée';


      const borderColor =

        report.meeting_type ===
        'assemblee_generale'

        ? '#7b2cbf'

        : '#2563eb';


      return `

        <div
          class="card"
          style="
            margin-bottom:12px;
            border-left:4px solid
              ${borderColor};
          "
        >

          <h3
            style="
              margin-top:0;
              margin-bottom:8px;
            "
          >

            ${type}

          </h3>


          <p style="margin:5px 0;">

            📅

            <strong>
              ${date}
            </strong>

          </p>


          <p style="margin:5px 0;">

            📝

            <strong>
              ${esc(report.title || '')}
            </strong>

          </p>


          <div
            class="row"
            style="
              margin-top:12px;
              gap:8px;
              flex-wrap:wrap;
            "
          >

            <button
              type="button"
              class="primary"
              onclick="
                editMeetingReport('${report.id}');
              "
            >

              ✏️ Modifier

            </button>


            <button
              type="button"
              class="primary"
              onclick="
                printMeetingReport('${report.id}');
              "
            >

              🖨️ Imprimer

            </button>


            <button
              type="button"
              class="danger"
              onclick="
                deleteMeetingReport('${report.id}');
              "
            >

              🗑️ Supprimer

            </button>

          </div>

        </div>

      `;

    }).join('');

}


window.loadAdminMeetingReports =
  loadAdminMeetingReports;


// ============================================================
// ✏️ MODIFIER UN COMPTE RENDU
// ============================================================

async function editMeetingReport(id){

  const {data:report,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .eq('id',id)
      .single();


  if(error || !report){

    console.error(error);

    alert(
      '❌ Impossible de récupérer le compte rendu.'
    );

    return;

  }


  const {data:loadedTopics,error:topicsError} =
    await db
      .from('meeting_report_topics')
      .select('*')
      .eq('report_id',id)
      .order(
        'topic_order',
        {
          ascending:true
        }
      );


  if(topicsError){

    console.error(topicsError);

    alert(
      '❌ Impossible de récupérer les thèmes.'
    );

    return;

  }


  let editTopics =

    loadedTopics &&
    loadedTopics.length

      ? loadedTopics.map(topic => ({

          id:
            topic.id,

          topic:
            topic.topic || '',

          content:
            topic.content || '',

          topic_order:
            topic.topic_order || 0

        }))

      : [

          {

            id:null,

            topic:'',

            content:'',

            topic_order:0

          }

        ];


  // ==========================================================
  // 📌 AFFICHAGE DES THÈMES
  // ==========================================================

  function renderEditTopics(){

    return editTopics.map((topic,index) => `

      <div
        class="card"
        style="
          margin-top:12px;
          padding:15px;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
          "
        >

          <h4 style="margin:0;">

            📌 Thème ${index + 1}

          </h4>


          ${
            editTopics.length > 1

            ? `

              <button
                type="button"
                class="danger"
                onclick="
                  removeEditMeetingTopic(${index});
                "
              >

                🗑️

              </button>

            `

            : ''

          }

        </div>


        <label
          style="
            display:block;
            margin-top:12px;
          "
        >

          Thème abordé

          <input
            type="text"
            id="editMeetingTopic_${index}"
            value="${esc(topic.topic || '')}"
            placeholder="Ex : Organisation des manifestations"
          >

        </label>


        <label
          style="
            display:block;
            margin-top:12px;
          "
        >

          Compte rendu du thème

          <textarea
            id="editMeetingContent_${index}"
            rows="6"
            placeholder="Saisissez le compte rendu..."
          >${esc(topic.content || '')}</textarea>

        </label>

      </div>

    `).join('');

  }


  // ==========================================================
  // 💾 RÉCUPÉRER LES SAISIES AVANT RAFRAÎCHISSEMENT
  // ==========================================================

  function saveCurrentEditTopics(){

    editTopics.forEach((topic,index) => {

      const topicInput =
        document.getElementById(
          `editMeetingTopic_${index}`
        );


      const contentInput =
        document.getElementById(
          `editMeetingContent_${index}`
        );


      if(topicInput){

        topic.topic =
          topicInput.value;

      }


      if(contentInput){

        topic.content =
          contentInput.value;

      }

    });

  }


  // ==========================================================
  // 🗑️ SUPPRIMER UN THÈME
  // ==========================================================

  window.removeEditMeetingTopic =
    function(index){

      saveCurrentEditTopics();


      editTopics.splice(
        index,
        1
      );


      if(!editTopics.length){

        editTopics.push({

          id:null,

          topic:'',

          content:'',

          topic_order:0

        });

      }


      const container =
        $('editMeetingTopicsContainer');


      if(container){

        container.innerHTML =
          renderEditTopics();

      }

    };


  // ==========================================================
  // ➕ AJOUTER UN THÈME
  // ==========================================================

  window.addEditMeetingTopic =
    function(){

      // IMPORTANT :
      // sauvegarder avant de reconstruire les champs

      saveCurrentEditTopics();


      editTopics.push({

        id:null,

        topic:'',

        content:'',

        topic_order:
          editTopics.length

      });


      const container =
        $('editMeetingTopicsContainer');


      if(container){

        container.innerHTML =
          renderEditTopics();

      }

    };


  // ==========================================================
  // 🪟 POPUP MODIFICATION
  // ==========================================================

  openModal(`

    <h2>

      ✏️ Modifier le compte rendu

    </h2>


    <label>

      Type de réunion

      <select id="editMeetingType">

        <option
          value="amicale"
          ${
            report.meeting_type ===
            'amicale'
              ? 'selected'
              : ''
          }
        >

          🔵 Réunion amicale

        </option>


        <option
          value="assemblee_generale"
          ${
            report.meeting_type ===
            'assemblee_generale'
              ? 'selected'
              : ''
          }
        >

          🟣 Assemblée générale

        </option>

      </select>

    </label>


    <label
      style="
        display:block;
        margin-top:12px;
      "
    >

      Date de la réunion

      <input
        type="date"
        id="editMeetingDate"
        value="${report.meeting_date || ''}"
      >

    </label>


    <label
      style="
        display:block;
        margin-top:12px;
      "
    >

      Titre de la réunion

      <input
        type="text"
        id="editMeetingTitle"
        value="${esc(report.title || '')}"
        placeholder="Ex : Réunion de septembre"
      >

    </label>


    <h3
      style="
        margin-top:20px;
        margin-bottom:5px;
      "
    >

      📌 Thèmes abordés

    </h3>


    <div
      id="editMeetingTopicsContainer"
    >

      ${renderEditTopics()}

    </div>


    <button
      type="button"
      class="primary"
      style="margin-top:12px;"
      onclick="addEditMeetingTopic()"
    >

      ➕ Ajouter un thème

    </button>


    <div
      class="row"
      style="
        margin-top:20px;
        gap:10px;
        flex-wrap:wrap;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="
          updateMeetingReport('${id}');
        "
      >

        💾 Enregistrer les modifications

      </button>


      <button
        type="button"
        class="secondary"
        onclick="closeModal()"
      >

        Annuler

      </button>

    </div>

  `);

}


window.editMeetingReport =
  editMeetingReport;


// ============================================================
// 💾 ENREGISTRER LES MODIFICATIONS
// ============================================================

async function updateMeetingReport(id){

  const meetingType =
    $('editMeetingType')?.value;

  const meetingDate =
    $('editMeetingDate')?.value;

  const title =
    $('editMeetingTitle')?.value.trim();


  if(!meetingType){

    alert(
      'Veuillez choisir le type de réunion.'
    );

    return;

  }


  if(!meetingDate){

    alert(
      'Veuillez choisir une date.'
    );

    return;

  }


  if(!title){

    alert(
      'Veuillez renseigner le titre.'
    );

    return;

  }


  const cards =
    document.querySelectorAll(
      '#editMeetingTopicsContainer .card'
    );


  const topics = [];


  cards.forEach((card,index) => {

    const topicInput =
      card.querySelector(
        `#editMeetingTopic_${index}`
      );


    const contentInput =
      card.querySelector(
        `#editMeetingContent_${index}`
      );


    const topic =
      topicInput?.value.trim() || '';


    const content =
      contentInput?.value.trim() || '';


    if(topic || content){

      topics.push({

        topic:topic,

        content:content,

        topic_order:
          topics.length

      });

    }

  });


  if(!topics.length){

    alert(
      'Veuillez ajouter au moins un thème.'
    );

    return;

  }


  // ==========================================================
  // ✏️ MODIFIER LE COMPTE RENDU
  // ==========================================================

  const {error:updateError} =
    await db
      .from('meeting_reports')
      .update({

        meeting_type:
          meetingType,

        meeting_date:
          meetingDate,

        title:
          title,

        updated_at:
          new Date().toISOString()

      })
      .eq('id',id);


  if(updateError){

    console.error(
      'Erreur modification compte rendu :',
      updateError
    );

    alert(
      '❌ Impossible de modifier le compte rendu.'
    );

    return;

  }


  // ==========================================================
  // 🗑️ SUPPRIMER LES ANCIENS THÈMES
  // ==========================================================

  const {error:deleteTopicsError} =
    await db
      .from('meeting_report_topics')
      .delete()
      .eq('report_id',id);


  if(deleteTopicsError){

    console.error(
      'Erreur suppression anciens thèmes :',
      deleteTopicsError
    );

    alert(
      '❌ Impossible de mettre à jour les thèmes.'
    );

    return;

  }


  // ==========================================================
  // ➕ AJOUTER LES NOUVEAUX THÈMES
  // ==========================================================

  const topicRows =
    topics.map((topic,index) => ({

      report_id:
        id,

      topic:
        topic.topic,

      content:
        topic.content,

      topic_order:
        index

    }));


  const {error:insertTopicsError} =
    await db
      .from('meeting_report_topics')
      .insert(topicRows);


  if(insertTopicsError){

    console.error(
      'Erreur ajout nouveaux thèmes :',
      insertTopicsError
    );

    alert(
      '❌ Impossible d’enregistrer les thèmes.'
    );

    return;

  }


  alert(
    '✅ Compte rendu modifié avec succès.'
  );


  closeModal();


  await loadAdminMeetingReports();

}


window.updateMeetingReport =
  updateMeetingReport;


// ============================================================
// 🖨️ IMPRIMER UN COMPTE RENDU
// ============================================================

async function printMeetingReport(id){

  const {data:report,error} =
    await db
      .from('meeting_reports')
      .select('*')
      .eq('id',id)
      .single();


  if(error || !report){

    console.error(error);

    alert(
      '❌ Impossible de récupérer le compte rendu.'
    );

    return;

  }


  const {data:topics,error:topicsError} =
    await db
      .from('meeting_report_topics')
      .select('*')
      .eq('report_id',id)
      .order(
        'topic_order',
        {
          ascending:true
        }
      );


  if(topicsError){

    console.error(topicsError);

    alert(
      '❌ Impossible de récupérer les thèmes.'
    );

    return;

  }


  const type =

    report.meeting_type ===
    'assemblee_generale'

      ? 'ASSEMBLÉE GÉNÉRALE'

      : 'RÉUNION AMICALE';


  const date =

    report.meeting_date

      ? new Date(
          report.meeting_date +
          'T00:00:00'
        ).toLocaleDateString(
          'fr-FR'
        )

      : 'Date non renseignée';


  const topicsHtml =

    (topics || []).map((topic,index) => `

      <div
        style="
          margin-bottom:25px;
          page-break-inside:avoid;
        "
      >

        <h3
          style="
            margin-bottom:8px;
            border-bottom:1px solid #ccc;
            padding-bottom:6px;
          "
        >

          ${index + 1}.
          ${esc(topic.topic || 'Thème')}

        </h3>


        <div
          style="
            white-space:pre-wrap;
            line-height:1.6;
          "
        >

          ${esc(topic.content || '')}

        </div>

      </div>

    `).join('');


  const printWindow =
    window.open(
      '',
      '_blank'
    );


  if(!printWindow){

    alert(
      '❌ La fenêtre d’impression a été bloquée par le navigateur.'
    );

    return;

  }


  printWindow.document.write(`

    <!DOCTYPE html>

    <html lang="fr">

    <head>

      <meta charset="UTF-8">

      <title>
        Compte rendu - ${esc(report.title || '')}
      </title>


      <style>

        @page{

          margin:20mm;

        }


        body{

          font-family:
            Arial,
            sans-serif;

          color:#111;

          margin:0;

          line-height:1.5;

        }


        .header{

          text-align:center;

          margin-bottom:30px;

        }


        .type{

          font-size:22px;

          font-weight:bold;

          margin-bottom:8px;

        }


        .date{

          font-size:15px;

          color:#555;

        }


        .title{

          font-size:26px;

          font-weight:bold;

          margin-top:15px;

        }


        .footer{

          margin-top:40px;

          padding-top:15px;

          border-top:1px solid #ccc;

          text-align:center;

          font-size:12px;

          color:#666;

        }


      </style>

    </head>


    <body>


      <div class="header">

        <div class="type">

          ${type}

        </div>


        <div class="date">

          📅 ${date}

        </div>


        <div class="title">

          ${esc(report.title || '')}

        </div>

      </div>


      ${topicsHtml}


      <div class="footer">

        Compte rendu de réunion

      </div>


    </body>

    </html>

  `);


  printWindow.document.close();


  printWindow.focus();


  setTimeout(
    () => {

      printWindow.print();

    },
    300
  );

}


window.printMeetingReport =
  printMeetingReport;


// ============================================================
// 🗑️ SUPPRIMER UN COMPTE RENDU
// ============================================================

async function deleteMeetingReport(id){

  if(!confirm(
    'Voulez-vous vraiment supprimer ce compte rendu ?'
  )){

    return;

  }


  // ==========================================================
  // 🗑️ SUPPRIMER LES THÈMES
  // ==========================================================

  const {error:topicsError} =
    await db
      .from('meeting_report_topics')
      .delete()
      .eq(
        'report_id',
        id
      );


  if(topicsError){

    console.error(
      'Erreur suppression thèmes :',
      topicsError
    );

    alert(
      '❌ Impossible de supprimer les thèmes du compte rendu.'
    );

    return;

  }


  // ==========================================================
  // 🗑️ SUPPRIMER LE COMPTE RENDU
  // ==========================================================

  const {error} =
    await db
      .from('meeting_reports')
      .delete()
      .eq(
        'id',
        id
      );


  if(error){

    console.error(
      'Erreur suppression compte rendu :',
      error
    );

    alert(
      '❌ Impossible de supprimer le compte rendu.'
    );

    return;

  }


  alert(
    '✅ Compte rendu supprimé.'
  );


  await loadAdminMeetingReports();

}


window.deleteMeetingReport =
  deleteMeetingReport;


async function newEvent(){
  openModal(`
    <h2>🎉 Créer une festivité</h2>

    <div class="field">
      <label>Titre</label>
      <input id="eventTitle" class="input" placeholder="Nom de la festivité">
    </div>

    <div class="field">
      <label>Date</label>
      <input id="eventDate" class="input" type="date">
    </div>

    <div class="field">
      <label>Heure</label>
      <input id="eventTime" class="input" type="time">
    </div>

    <div class="field">
      <label>Lieu</label>
      <input id="eventLocation" class="input" placeholder="Lieu de la festivité">
    </div>

    <div class="field">
      <label>Description</label>
      <textarea id="eventDescription" class="textarea" placeholder="Description de la festivité"></textarea>
    </div>

<div class="field">
  <label>🖼️ Affiche de la festivité</label>

  <input
    id="eventPoster"
    class="input"
    type="file"
    accept="image/*"
    onchange="previewEventPoster()"
  >

  <div
    id="eventPosterPreview"
    style="
      display:none;
      margin-top:10px;
    "
  >
    <img
      id="eventPosterPreviewImg"
      src=""
      alt="Aperçu de l'affiche"
      style="
        width:100%;
        max-height:300px;
        object-fit:contain;
        border-radius:12px;
        border:1px solid #ddd;
      "
    >
  </div>
</div>

    <div class="field">
      <label class="check">
        <input id="eventSpouse" type="checkbox">
        Conjoints invités
      </label>
    </div>

    <div class="field">
      <label class="check">
        <input id="eventChildren" type="checkbox">
        Enfants invités
      </label>
    </div>

    <div class="field">
      <label class="check">
        <input id="eventGift" type="checkbox">
        Bon cadeau
      </label>
    </div>

    <div class="field">
      <label>Montant du bon cadeau</label>
      <input id="eventGiftAmount" class="input" type="number" step="0.01" min="0" placeholder="Montant en €">
    </div>

    <div class="field">
      <label>Date limite de réponse</label>
      <input id="eventDeadline" class="input" type="datetime-local">
    </div>

    <div class="row">
      <button class="primary" onclick="saveEvent()">💾 Créer</button>
      <button class="ghost" onclick="closeModal()">Annuler</button>
    </div>
  `);
}

async function showAdminMessages(){

  try{

    // =====================================================
    // 📨 MESSAGES REÇUS PAR LE BUREAU AMICALE
    // =====================================================

    const {data:messagesData,error:messagesError} =
      await db
        .from('member_messages')
        .select(`
          id,
          sender_id,
          receiver_type,
          subject,
          content,
          created_at,
          read_at
        `)
        .eq(
          'receiver_type',
          'bureau'
        )
        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(messagesError)
      throw messagesError;


    const messages =
      messagesData || [];


    // =====================================================
    // 👥 CHARGEMENT DES MEMBRES
    // =====================================================

    const {data:membersData,error:membersError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name
        `);


    if(membersError)
      throw membersError;


    const members =
      membersData || [];


    // =====================================================
    // 📨 AFFICHAGE
    // =====================================================

    openModal(`

      <h2>
        📨 Messages reçus
      </h2>


      ${
        messages.length

        ? `

          <div>

            ${
              messages.map(message => {

                // -----------------------------------------
                // 👤 EXPÉDITEUR
                // -----------------------------------------

                const sender =
                  members.find(
                    m =>
                      String(m.id) ===
                      String(message.sender_id)
                  );


                const senderName =
                  sender

                    ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()

                    : 'Membre inconnu';


                // -----------------------------------------
                // 👁️ LECTURE
                // -----------------------------------------

                const isRead =
                  !!message.read_at;


                return `

                  <div
                    class="card"
                    style="
                      margin-bottom:12px;
                      cursor:pointer;
                    "
                    onclick="
                      openAdminMemberMessage(
                        '${message.id}'
                      );
                    "
                  >

                    <div
                      style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        gap:10px;
                      "
                    >

                      <h3
                        style="
                          margin:0;
                        "
                      >

                        ${
                          isRead
                            ? '📨'
                            : '🔴'
                        }

                        ${esc(
                          message.subject ||
                          'Sans objet'
                        )}

                      </h3>


                      ${
                        isRead

                          ? `

                            <span
                              style="
                                font-size:12px;
                                opacity:0.7;
                              "
                            >

                              ✓ Lu

                            </span>

                          `

                          : `

                            <span
                              style="
                                font-size:12px;
                                font-weight:bold;
                              "
                            >

                              🔴 Non lu

                            </span>

                          `
                      }

                    </div>


                    <p
                      style="
                        margin:8px 0 4px;
                      "
                    >

                      👤

                      <strong>

                        ${esc(
                          senderName
                        )}

                      </strong>

                    </p>


                    <p
                      class="muted"
                      style="
                        margin:4px 0;
                      "
                    >

                      📨 Bureau Amicale

                    </p>


                    <p
                      class="muted"
                      style="
                        margin:4px 0;
                      "
                    >

                      📅

                      ${fmtDate(
                        message.created_at
                      )}

                    </p>


                    <div
                      style="
                        margin-top:8px;
                        font-size:13px;
                        opacity:0.7;
                      "
                    >

                      👆 Cliquer pour ouvrir

                    </div>


                    <!-- =================================
                         🗑️ SUPPRESSION
                    ================================== -->

                    <button
                      type="button"
                      class="primary"
                      onclick="
                        event.stopPropagation();
                        deleteReceivedMemberMessage(
                          '${message.id}'
                        );
                      "
                      style="
                        margin-top:8px;
                      "
                    >

                      🗑️ Supprimer

                    </button>

                  </div>

                `;

              }).join('')
            }

          </div>

        `

        : `

          <div class="card">

            <p>

              📭 Aucun message reçu.

            </p>

          </div>

        `
      }

<div
  class="row"
  style="
    margin-top:15px;
    display:flex;
    gap:10px;
    flex-wrap:wrap;
  "
>

  <button
    type="button"
    class="secondary"
    onclick="showAdminSentMessages()"
  >

    📤 Messages envoyés

  </button>


  <button
    type="button"
    class="primary"
    onclick="closeModal()"
  >

    Fermer

  </button>

</div>
    `);


  }catch(error){

    console.error(
      'ERREUR CHARGEMENT MESSAGES BUREAU :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger les messages.'
    );

  }

}


window.showAdminMessages =
  showAdminMessages;

async function showAdminSentMessages(){

  try{

    // =====================================================
    // 📤 CHARGEMENT DES MESSAGES ENVOYÉS
    // =====================================================

    const {data:messagesData,error:messagesError} =
      await db
        .from('admin_notes')
        .select(`
          id,
          title,
          content,
          created_at,
          active,
          recipient_type,
          recipient_member_id
        `)
        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(messagesError)
      throw messagesError;


    const messages =
      messagesData || [];


    // =====================================================
    // 👁️ CHARGEMENT DES LECTURES
    // =====================================================

    const {data:readsData,error:readsError} =
      await db
        .from('admin_note_reads')
        .select(`
          note_id,
          member_id,
          read_at
        `);


    if(readsError)
      throw readsError;


    const reads =
      readsData || [];


    // =====================================================
    // 👥 CHARGEMENT DES MEMBRES
    // =====================================================

    const {data:membersData,error:membersError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          bureau_member
        `);


    if(membersError)
      throw membersError;


    const members =
      membersData || [];


    // =====================================================
    // 📤 AFFICHAGE DES MESSAGES
    // =====================================================

    openModal(`

      <h2>
        📤 Messages envoyés
      </h2>


      ${
        messages.length

        ? `

          <div>

            ${
              messages.map(note => {

                // =========================================
                // 👁️ LECTURES
                // =========================================

                const noteReads =
                  reads.filter(
                    r =>
                      String(r.note_id) ===
                      String(note.id)
                  );


                const readCount =
                  noteReads.length;


                // =========================================
                // 🎯 DESTINATAIRE
                // =========================================

                let recipientLabel =
                  '📢 Tous les membres';


                if(
                  note.recipient_type ===
                  'bureau'
                ){

                  recipientLabel =
                    '🏛️ Membres du bureau';

                }


                else if(
                  note.recipient_type ===
                  'member'
                ){

                  const recipient =
                    members.find(
                      m =>
                        String(m.id) ===
                        String(
                          note.recipient_member_id
                        )
                    );


                  recipientLabel =
                    recipient

                      ? `👤 ${esc(
                          `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
                        )}`

                      : '👤 Membre précis';

                }


                // =========================================
                // 📨 CARTE
                // =========================================

                return `

                  <div
                    class="card"
                    style="
                      margin-bottom:12px;
                    "
                  >

                    <!-- =================================
                         TITRE
                    ================================== -->

                    <h3
                      style="
                        margin-top:0;
                        margin-bottom:8px;
                      "
                    >

                      📨
                      ${esc(
                        note.title ||
                        'Message'
                      )}

                    </h3>


                    <!-- =================================
                         DESTINATAIRE
                    ================================== -->

                    <p
                      class="muted"
                      style="
                        margin:6px 0;
                      "
                    >

                      ${recipientLabel}

                    </p>


                    <!-- =================================
                         DATE
                    ================================== -->

                    <p
                      class="muted"
                      style="
                        margin:6px 0;
                      "
                    >

                      📅
                      ${fmtDate(
                        note.created_at
                      )}

                    </p>


                    <!-- =================================
                         APERÇU DU MESSAGE
                    ================================== -->

                    <div
                      style="
                        margin-top:10px;
                        padding:10px;
                        border-radius:8px;
                        background:rgba(0,0,0,0.04);
                        white-space:pre-wrap;
                      "
                    >

                      ${esc(
                        note.content ||
                        ''
                      )}

                    </div>


                    <!-- =================================
                         👁️ SUIVI DES LECTURES
                    ================================== -->

                    <button
                      type="button"
                      class="ghost"
                      onclick="
                        event.stopPropagation();

                        showAdminNoteReaders(
                          '${note.id}'
                        );
                      "
                      style="
                        margin-top:10px;
                      "
                    >

                      👁️

                      <strong>
                        ${readCount}
                      </strong>

                      ${
                        readCount === 1
                          ? 'personne a lu'
                          : 'personnes ont lu'
                      }

                    </button>


                    <!-- =================================
                         🗑️ SUPPRESSION
                    ================================== -->

                    <button
                      type="button"
                      class="primary"
                      onclick="
                        event.stopPropagation();

                        deleteAdminMessage(
                          '${note.id}'
                        );
                      "
                      style="
                        margin-left:8px;
                        margin-top:10px;
                      "
                    >

                      🗑️ Supprimer

                    </button>

                  </div>

                `;

              }).join('')
            }

          </div>

        `

        : `

          <div class="card">

            <p>
              📭 Aucun message envoyé.
            </p>

          </div>

        `
      }


      <!-- ===============================================
           🔙 BOUTONS
      ================================================ -->

      <div
        class="row"
        style="
          margin-top:15px;
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="secondary"
          onclick="showAdminMessages()"
        >

          📥 Messages reçus

        </button>


        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR CHARGEMENT MESSAGES ENVOYÉS ADMIN :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger les messages envoyés.'
    );

  }

}


window.showAdminSentMessages =
  showAdminSentMessages;


async function deleteReceivedMemberMessage(messageId){

  if(!confirm(
    'Voulez-vous vraiment supprimer ce message ?'
  )){
    return;
  }


  try{

    const {error} =
      await db
        .from('member_messages')
        .delete()
        .eq(
          'id',
          messageId
        );


    if(error)
      throw error;


    alert(
      'Message supprimé.'
    );


    // Recharger la liste des messages reçus
    showAdminMessages();


  }catch(error){

    console.error(
      'ERREUR SUPPRESSION MESSAGE REÇU :',
      error
    );


    alert(
      error.message ||
      'Impossible de supprimer le message.'
    );

  }

}


window.deleteReceivedMemberMessage =
  deleteReceivedMemberMessage;

async function openAdminMemberMessage(messageId){

  try{

    // =====================================================
    // 📨 CHARGER LE MESSAGE
    // =====================================================

    const {data:message,error:messageError} =
      await db
        .from('member_messages')
        .select(`
          id,
          sender_id,
          receiver_type,
          subject,
          content,
          created_at,
          read_at
        `)
        .eq(
          'id',
          messageId
        )
        .single();


    if(messageError)
      throw messageError;


    if(!message){

      alert(
        'Message introuvable.'
      );

      return;

    }


    // =====================================================
    // 👤 CHARGER L'EXPÉDITEUR
    // =====================================================

    const {data:sender,error:senderError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name
        `)
        .eq(
          'id',
          message.sender_id
        )
        .single();


    if(senderError)
      throw senderError;


    const senderName =
      sender

        ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()

        : 'Membre inconnu';


    // =====================================================
    // 👁️ MARQUER COMME LU
    // =====================================================

    if(!message.read_at){

      const {error:readError} =
        await db
          .from('member_messages')
          .update({

            read_at:
              new Date().toISOString()

          })
          .eq(
            'id',
            message.id
          );


      if(readError){

        console.error(
          'ERREUR MARQUAGE MESSAGE ADMIN LU :',
          readError
        );

      }

    }


    // =====================================================
    // 📨 AFFICHAGE
    // =====================================================

    openModal(`

      <h2>
        📨 Message reçu
      </h2>


      <div
        class="card"
        style="
          margin-top:15px;
        "
      >

        <h3>
          👤
          ${esc(
            senderName
          )}
        </h3>


        <p
          style="
            margin-top:10px;
            font-weight:600;
          "
        >

          ${esc(
            message.subject ||
            'Sans objet'
          )}

        </p>


        <div
          style="
            margin-top:15px;
            white-space:pre-wrap;
          "
        >

          ${esc(
            message.content ||
            ''
          )}

        </div>


        ${
          message.created_at

            ? `

              <small
                class="muted"
                style="
                  display:block;
                  margin-top:15px;
                "
              >

                📅
                ${new Date(
                  message.created_at
                ).toLocaleString(
                  'fr-FR'
                )}

              </small>

            `

            : ''
        }


        <div
          style="
            margin-top:10px;
            font-size:13px;
          "
        >

          👁️ Lu

        </div>

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="
            replyToMemberMessage(
              '${message.id}',
              '${message.sender_id}'
            );
          "
        >

          ↩️ Répondre

        </button>


        <button
          type="button"
          class="ghost"
          onclick="
            showAdminMessages();
          "
        >

          ← Retour aux messages

        </button>


        <button
          type="button"
          class="ghost"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR OUVERTURE MESSAGE ADMIN :',
      error
    );


    alert(
      error.message ||
      'Impossible d’ouvrir le message.'
    );

  }

}


window.openAdminMemberMessage =
  openAdminMemberMessage;

async function replyToMemberMessage(
  originalMessageId,
  memberId
){

  try{

    // =====================================================
    // 👤 RECUPERER LE MEMBRE
    // =====================================================

    const {data:memberTarget,error:memberError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name
        `)
        .eq(
          'id',
          memberId
        )
        .single();


    if(memberError)
      throw memberError;


    const memberName =
      memberTarget

        ? `${memberTarget.first_name || ''} ${memberTarget.last_name || ''}`.trim()

        : 'Membre';


    // =====================================================
    // 📨 FORMULAIRE DE REPONSE
    // =====================================================

    openModal(`

      <h2>
        ↩️ Répondre à ${esc(memberName)}
      </h2>


      <input
        id="adminReplySubject"
        type="text"
        placeholder="Objet"
        style="
          width:100%;
          margin-top:15px;
        "
      >


      <textarea
        id="adminReplyContent"
        rows="6"
        placeholder="Écrivez votre réponse..."
        style="
          width:100%;
          margin-top:10px;
          resize:vertical;
        "
      ></textarea>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="
            sendAdminMemberReply(
              '${originalMessageId}',
              '${memberId}'
            );
          "
        >

          📨 Envoyer la réponse

        </button>


        <button
          type="button"
          class="ghost"
          onclick="
            openAdminMemberMessage(
              '${originalMessageId}'
            );
          "
        >

          ← Retour

        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR FORMULAIRE REPONSE :',
      error
    );


    alert(
      error.message ||
      'Impossible de préparer la réponse.'
    );

  }

}


window.replyToMemberMessage =
  replyToMemberMessage;

async function sendAdminMemberReply(
  originalMessageId,
  memberId
){

  try{

    const subject =
      document
        .getElementById(
          'adminReplySubject'
        )
        ?.value
        ?.trim();


    const content =
      document
        .getElementById(
          'adminReplyContent'
        )
        ?.value
        ?.trim();


    if(!content){

      alert(
        'Veuillez écrire une réponse.'
      );

      return;

    }


    // =====================================================
    // 📨 ENVOI
    // =====================================================

    const {error} =
      await db
        .from('member_messages')
        .insert({

          sender_id:
            member.id,

          receiver_id:
            memberId,

          receiver_type:
            'member',

          subject:
            subject ||
            'Réponse du Bureau Amicale',

          content:
            content,

          parent_id:
            originalMessageId

        });


    if(error)
      throw error;


    alert(
      'Réponse envoyée au membre.'
    );


    // Retour à la liste
    showAdminMessages();


  }catch(error){

    console.error(
      'ERREUR ENVOI REPONSE ADMIN :',
      error
    );


    alert(
      error.message ||
      'Impossible d’envoyer la réponse.'
    );

  }

}


window.sendAdminMemberReply =
  sendAdminMemberReply;



async function deleteAdminMessage(noteId){

  if(!noteId) return;

  if(!confirm('Voulez-vous vraiment supprimer ce message ?')){
    return;
  }

  try{

    const {data,error} = await db
      .from('admin_notes')
      .delete()
      .eq('id',noteId)
      .select();

    console.log('SUPPRESSION MESSAGE :', {
      noteId,
      data,
      error
    });

    if(error){
      throw error;
    }

    if(!data || data.length === 0){

      alert(
        'Le message n’a pas été supprimé. Vérifie les droits RLS de la table admin_notes.'
      );

      return;
    }

    await showAdminMessages();

  }catch(error){

    console.error(
      'ERREUR SUPPRESSION MESSAGE ADMIN :',
      error
    );

    alert(
      'Erreur lors de la suppression :\n' +
      (error.message || error)
    );

  }

}

window.deleteAdminMessage = deleteAdminMessage;


async function saveEvent(){
  try{

    const title=$('eventTitle')?.value.trim()||'';
    const event_date=$('eventDate')?.value||'';
    const event_time=$('eventTime')?.value||null;
    const location=$('eventLocation')?.value.trim()||'';
    const description=$('eventDescription')?.value.trim()||'';

    const spouses_invited=$('eventSpouse')?.checked||false;
    const children_invited=$('eventChildren')?.checked||false;

    const gift_enabled=$('eventGift')?.checked||false;
    const gift_amount=Number($('eventGiftAmount')?.value||0)||null;

    const response_deadline=$('eventDeadline')?.value
      ? new Date($('eventDeadline').value).toISOString()
      : null;


    /* =====================================================
       🖼️ AFFiche
       ===================================================== */

    const posterFile =
      $('eventPoster')?.files?.[0] || null;


    if(!title||!event_date){

      alert(
        'Le titre et la date sont obligatoires.'
      );

      return;
    }


    /* =====================================================
       1. CRÉATION DE LA FESTIVITÉ
       ===================================================== */

    const { data:eventData, error } =
      await db
        .from('events')
        .insert({

          title,
          event_date,
          event_time,
          location,
          description,

          spouses_invited,
          children_invited,

          gift_enabled,
          gift_amount,

          response_deadline,

          active:true,
          archived:false,

          created_by:
            member?.id||null

        })
        .select('id')
        .single();


    if(error)throw error;


    /* =====================================================
       2. UPLOAD DE L'AFFICHE
       ===================================================== */

    let poster_url=null;


    if(posterFile){

      const extension =
        posterFile.name
          .split('.')
          .pop()
          .toLowerCase();


      const safeExtension =
        ['jpg','jpeg','png','webp','gif']
          .includes(extension)
          ? extension
          : 'jpg';


      const fileName =
        `${eventData.id}_${Date.now()}.${safeExtension}`;


      const filePath =
        `events/${fileName}`;

const { data: sessionData } = await db.auth.getSession();

console.log(
  '🔐 SESSION UPLOAD :',
  sessionData?.session
    ? {
        user_id: sessionData.session.user?.id,
        role: sessionData.session.user?.role,
        aud: sessionData.session.user?.aud
      }
    : 'AUCUNE SESSION'
);

      
      const {
        error:uploadError
      } =
        await db
          .storage
          .from('event-posters')
          .upload(
            filePath,
            posterFile,
            {
              cacheControl:'3600',
             upsert:false,
              contentType:
                posterFile.type ||
                'image/jpeg'
            }
          );


      if(uploadError){

        console.error(
          '❌ ERREUR UPLOAD AFFICHE :',
          uploadError
        );

        /*
          L'événement existe déjà.
          On ne le supprime pas si l'affiche
          rencontre un problème.
        */

        alert(
          '⚠️ La festivité a été créée, ' +
          'mais l’affiche n’a pas pu être envoyée.'
        );

      }else{

        const {
          data:publicUrlData
        } =
          db
            .storage
            .from('event-posters')
            .getPublicUrl(filePath);


        poster_url =
          publicUrlData?.publicUrl ||
          null;


        /* =================================================
           3. ENREGISTRER L'URL DE L'AFFICHE
           ================================================= */

        if(poster_url){

          const {
            error:updateError
          } =
            await db
              .from('events')
              .update({
                poster_url
              })
              .eq(
                'id',
                eventData.id
              );


          if(updateError){

            console.error(
              '❌ ERREUR ENREGISTREMENT AFFICHE :',
              updateError
            );

          }

        }

      }

    }


    // =====================================================
    // 🔔 NOTIFICATION PUSH — NOUVELLE FESTIVITÉ
    // =====================================================

    try{

      const {
        data: pushData,
        error: pushError
      } =
        await db.functions.invoke(
          'send-push',
          {

            body: {

              all_members:true,

              title:
                '🎉 Nouvelle festivité',

              message:
                `Une nouvelle festivité est disponible : ${title}`,

              /*
                L'affiche est envoyée à la fonction Push
                lorsqu'elle existe.
              */

              image:
                poster_url || null

            }

          }
        );


      if(pushError){

        console.error(
          '❌ ERREUR PUSH FESTIVITÉ :',
          pushError
        );

      }else{

        console.log(
          '✅ PUSH FESTIVITÉ ENVOYÉ :',
          pushData
        );

      }

    }catch(pushError){

      /*
        IMPORTANT :
        Une erreur Push ne doit jamais empêcher
        la création de la festivité.
      */

      console.error(
        '❌ ERREUR PUSH FESTIVITÉ :',
        pushError
      );

    }


    closeModal();


    alert(
      poster_url
        ? '✅ Festivité créée avec son affiche.'
        : '✅ Festivité créée.'
    );


    await renderAdmin();


  }catch(error){

    console.error(
      'ERREUR CRÉATION FESTIVITÉ :',
      error
    );


    alert(
      error.message ||
      'Impossible de créer la festivité.'
    );

  }
}

async function editEvent(id){
  try{
    const {data:e,error}=await db.from('events').select('*').eq('id',id).single();
    if(error)throw error;
    openModal(`<h2>✏️ Modifier la festivité</h2><div class="field"><label>Titre</label><input id="eventTitle" class="input" value="${esc(e.title||'')}"></div><div class="field"><label>Date</label><input id="eventDate" class="input" type="date" value="${e.event_date||''}"></div><div class="field"><label>Heure</label><input id="eventTime" class="input" type="time" value="${e.event_time?e.event_time.slice(0,5):''}"></div><div class="field"><label>Lieu</label><input id="eventLocation" class="input" value="${esc(e.location||'')}"></div><div class="field"><label>Description</label><textarea id="eventDescription" class="textarea">${esc(e.description||'')}</textarea></div><div class="row"><button class="primary" onclick="updateEvent('${e.id}')">💾 Enregistrer</button><button class="ghost" onclick="closeModal()">Annuler</button></div>`);
  }catch(error){alert(error.message||'Impossible de charger la festivité.');}
}

async function updateEvent(id){
  try{
    const title=$('eventTitle')?.value.trim()||'',event_date=$('eventDate')?.value||'',event_time=$('eventTime')?.value||null,location=$('eventLocation')?.value.trim()||'',description=$('eventDescription')?.value.trim()||'';
    if(!title||!event_date){alert('Le titre et la date sont obligatoires.');return;}
    const {error}=await db.from('events').update({title,event_date,event_time,location,description}).eq('id',id);
    if(error)throw error;
    closeModal();alert('✅ Festivité modifiée.');await renderAdmin();
  }catch(error){alert(error.message||'Impossible de modifier la festivité.');}
}

async function deleteEvent(id){
  if(!confirm('Supprimer cette festivité ?'))return;
  try{
    const {error}=await db.from('events').delete().eq('id',id);
    if(error)throw error;
    alert('🗑️ Festivité supprimée.');await renderAdmin();
  }catch(error){alert(error.message||'Impossible de supprimer la festivité.');}
}


// ============================================================
// ACTIVATION / DESACTIVATION DES FESTIVITES
// ============================================================

async function toggleEventActive(id){

  try{

    const event = (adminDashboardData.events || [])
      .find(e => String(e.id) === String(id));

    if(!event){
      alert("Festivité introuvable.");
      return;
    }

    const newActive = event.active === false;

    const {error} = await db
      .from('events')
      .update({active:newActive})
      .eq('id',id);

    if(error) throw error;

    event.active = newActive;

    alert(
      newActive
        ? "✅ Festivité réactivée."
        : "⏸️ Festivité désactivée."
    );

    openAdminCurrentFestivities();

  }catch(error){

    console.error(error);
    alert(error.message || "Impossible de modifier le statut.");

  }

}


// ============================================================
// ACTIVATION / DESACTIVATION DES SONDAGES
// ============================================================

async function togglePollActive(id){

  try{

    const poll = (adminDashboardData.polls || [])
      .find(p => String(p.id) === String(id));

    if(!poll){
      alert("Sondage introuvable.");
      return;
    }

    const newActive = poll.active === false;

    const {error} = await db
      .from('polls')
      .update({active:newActive})
      .eq('id',id);

    if(error) throw error;

    poll.active = newActive;

    alert(
      newActive
        ? "✅ Sondage réactivé."
        : "⏸️ Sondage désactivé."
    );

    openAdminCurrentPolls();

  }catch(error){

    console.error(error);
    alert(error.message || "Impossible de modifier le statut.");

  }

}


async function showEventNonResponders(eventId) {
  try {
    // Récupérer les membres actifs
    const { data: members, error: membersError } = await db
      .from('members')
      .select('id, first_name, last_name')
      .eq('active', true)
      .order('last_name', { ascending: true });

    if (membersError) throw membersError;

    // Récupérer les réponses à cette festivité
    const { data: responses, error: responsesError } = await db
      .from('event_responses')
      .select('member_id')
      .eq('event_id', eventId);

    if (responsesError) throw responsesError;

    // Identifier les membres ayant déjà répondu
    const answeredIds = new Set(
      (responses || []).map(r => String(r.member_id))
    );

    // Garder uniquement les membres sans réponse
    const nonResponders = (members || []).filter(
      m => !answeredIds.has(String(m.id))
    );

    const rows = nonResponders.map(m => {
      const name =
        `${m.first_name || ''} ${m.last_name || ''}`.trim()
        || 'Nom inconnu';

      return `
        <tr>
          <td>${esc(name)}</td>
        </tr>
      `;
    }).join('');

    openModal(`
      <h2>👤 Membres n'ayant pas répondu</h2>

      <p>
        Nombre de non-répondants :
        <strong>${nonResponders.length}</strong>
      </p>

      <div class="table-wrap" style="margin-top:15px">
        <table class="table">
          <thead>
            <tr>
              <th>Nom et prénom</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `
              <tr>
                <td style="text-align:center">
                  ✅ Tous les membres ont répondu !
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="row" style="margin-top:15px">
        <button
          type="button"
          class="ghost"
          onclick="printCurrentModal()"
        >
          🖨️ Imprimer
        </button>

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >
          Fermer
        </button>
      </div>
    `);

  } catch (error) {
    console.error('ERREUR NON-RÉPONDANTS :', error);
    alert(
      error.message ||
      'Impossible de charger les non-répondants.'
    );
  }
}




async function eventRecap(id) {
  try {
    const { data: event, error: eventError } = await db
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) throw eventError;

    const { data: responses, error: responseError } = await db
      .from('event_responses')
      .select('*,members(first_name,last_name)')
      .eq('event_id', id);

    if (responseError) throw responseError;

    const { data: manualAttendees, error: manualError } = await db
      .from('event_manual_attendees')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    if (manualError) throw manualError;

    const list = responses || [];
    const manual = manualAttendees || [];

    const present = list.filter(r => r.attending === true);
    const absent = list.filter(r => r.attending === false);

    const manualPresent = manual.filter(r => r.attending === true);
    const manualAbsent = manual.filter(r => r.attending === false);

    const totalSpouses =
      present.filter(r => r.spouse_attending === true).length +
      manualPresent.filter(r => r.spouse_attending === true).length;

    const totalChildren =
      present.reduce((total, r) => total + Math.max(0, Number(r.children_count) || 0), 0) +
      manualPresent.reduce((total, r) => total + Math.max(0, Number(r.children_count) || 0), 0);

    const totalPresent = present.length + manualPresent.length;
    const totalParticipants = totalPresent + totalSpouses + totalChildren;

    const memberRows = list.map(r => {
      const m = r.members || {};
      const nom = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Membre inconnu';
      const commentaire = String(r.comment || '').trim();

      return `
        <tr>
          <td>
            <strong>${esc(nom)}</strong>
            ${commentaire ? `
              <div style="margin-top:5px;font-size:13px;opacity:.75;font-style:italic">
                💬 ${esc(commentaire)}
              </div>` : ''}
          </td>
          <td>${r.attending === true ? '✅ Présent(e)' : '❌ Absent(e)'}</td>
          <td>${r.attending === true ? (r.spouse_attending === true ? '💑 Oui' : 'Non') : '—'}</td>
          <td style="text-align:center">${r.attending === true ? Math.max(0, Number(r.children_count) || 0) : 0}</td>
          <td>—</td>
        </tr>
      `;
    }).join('');

    const manualRows = manual.map(r => {
      const commentaire = String(r.comment || '').trim();
      const nom = String(r.full_name || 'Participant externe');
      const conjoint = r.attending === true
        ? (r.spouse_attending === true
            ? `💑 Oui${r.spouse_name ? ` — ${esc(r.spouse_name)}` : ''}`
            : 'Non')
        : '—';
      const enfants = r.attending === true
        ? Math.max(0, Number(r.children_count) || 0)
        : 0;

      return `
        <tr>
          <td>
            <strong>${esc(nom)}</strong>
            <div style="font-size:12px;opacity:.7">Participant externe</div>
            ${commentaire ? `
              <div style="margin-top:5px;font-size:13px;opacity:.75;font-style:italic">
                💬 ${esc(commentaire)}
              </div>` : ''}
          </td>
          <td>${r.attending === true ? '✅ Présent(e)' : '❌ Absent(e)'}</td>
          <td>${conjoint}</td>
          <td style="text-align:center">${enfants}</td>
          <td>
            ${r.gift_requested === true ? 'Oui' : 'Non'}
            <button
              type="button"
              class="ghost"
              style="margin-left:6px;padding:4px 8px"
              onclick="deleteManualEventAttendee('${r.id}','${id}')"
              title="Supprimer ce participant"
            >🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    const allRows = memberRows + manualRows;

    openModal(`
      <h2>📋 Récapitulatif</h2>

      <h3>${esc(event.title || '')}</h3>

      <p>
        📅 ${typeof fmtDate === 'function' ? fmtDate(event.event_date) : (event.event_date || '')}
        ${event.event_time ? ` · ${esc(String(event.event_time).slice(0, 5))}` : ''}
      </p>

      <button
        type="button"
        class="primary"
        style="margin:12px 0"
        onclick="addManualEventAttendee('${id}')"
      >
        ➕ Ajouter un participant externe
      </button>

      <div class="table-wrap" style="margin-top:15px">
        <table class="table">
          <thead>
            <tr>
              <th>Personne</th>
              <th>Réponse</th>
              <th>Conjoint</th>
              <th>Enfants</th>
              <th>Bon cadeau / Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allRows || `
              <tr>
                <td colspan="5" style="text-align:center">
                  Aucun participant enregistré.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>

      <div class="card" style="margin-top:20px">
        <h3>📊 Total des participants</h3>

        <p>👤 Membres présents : <strong>${present.length}</strong></p>
        <p>➕ Participants externes présents : <strong>${manualPresent.length}</strong></p>
        <p>💑 Conjoints présents : <strong>${totalSpouses}</strong></p>
        <p>👶 Enfants présents : <strong>${totalChildren}</strong></p>

        <hr>

        <p style="font-size:18px">
          👥 Total personnes présentes :
          <strong>${totalParticipants}</strong>
        </p>

        <p>❌ Membres absents : <strong>${absent.length}</strong></p>
        <p>❌ Participants externes absents : <strong>${manualAbsent.length}</strong></p>
      </div>

      <div class="row" style="margin-top:15px">
        <button type="button" class="ghost" onclick="printCurrentModal()">
          🖨️ Imprimer
        </button>
        <button type="button" class="primary" onclick="closeModal()">
          Fermer
        </button>
      </div>
    `);
  } catch (error) {
    console.error('ERREUR RÉCAPITULATIF :', error);
    alert(error.message || 'Impossible de charger le récapitulatif.');
  }
}


/* =========================================================
   AJOUTER UN PARTICIPANT EXTERNE
========================================================= */

async function addManualEventAttendee(eventId) {
  openModal(`
    <h2>➕ Ajouter un participant externe</h2>

    <form id="manualAttendeeForm">
      <label for="manualFullName">Nom et prénom du participant *</label>
      <input
        id="manualFullName"
        type="text"
        required
        maxlength="150"
        placeholder="Nom et prénom"
      >

      <label for="manualAttending">Présence</label>
      <select id="manualAttending">
        <option value="true" selected>Présent(e)</option>
        <option value="false">Absent(e)</option>
      </select>

      <label for="manualSpouseName">Nom du conjoint (facultatif)</label>
      <input
        id="manualSpouseName"
        type="text"
        maxlength="150"
        placeholder="Nom du conjoint"
      >

      <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <input id="manualSpouseAttending" type="checkbox">
        Conjoint présent
      </label>

      <label for="manualChildrenCount">Nombre d'enfants présents</label>
      <input
        id="manualChildrenCount"
        type="number"
        min="0"
        step="1"
        value="0"
        required
      >

      <label style="display:flex;align-items:center;gap:8px;margin-top:12px">
        <input id="manualGiftRequested" type="checkbox">
        Bon cadeau demandé
      </label>

      <label for="manualComment">Commentaire (facultatif)</label>
      <textarea
        id="manualComment"
        rows="3"
        maxlength="1000"
        placeholder="Commentaire..."
      ></textarea>

      <div class="row" style="margin-top:15px">
        <button type="submit" class="primary">💾 Enregistrer</button>
        <button type="button" class="ghost" onclick="eventRecap('${eventId}')">
          Annuler
        </button>
      </div>
    </form>
  `);

  const form = document.getElementById('manualAttendeeForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fullName = document.getElementById('manualFullName').value.trim();
    const attending = document.getElementById('manualAttending').value === 'true';
    const spouseName = document.getElementById('manualSpouseName').value.trim();
    const spouseAttending = document.getElementById('manualSpouseAttending').checked;
    const childrenCount = Number(document.getElementById('manualChildrenCount').value);
    const giftRequested = document.getElementById('manualGiftRequested').checked;
    const comment = document.getElementById('manualComment').value.trim();

    if (!fullName) {
      alert('Veuillez saisir le nom et le prénom du participant.');
      return;
    }

    if (!Number.isInteger(childrenCount) || childrenCount < 0) {
      alert('Le nombre d’enfants doit être un nombre entier positif ou nul.');
      return;
    }

    if (!attending && (spouseAttending || childrenCount > 0)) {
      if (!confirm('Le participant est indiqué absent. Enregistrer quand même son conjoint et ses enfants comme non présents ?')) {
        return;
      }
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const { error } = await db
        .from('event_manual_attendees')
        .insert({
          event_id: eventId,
          full_name: fullName,
          attending,
          spouse_name: spouseName || null,
          spouse_attending: attending && spouseAttending,
          children_count: attending ? childrenCount : 0,
          gift_requested: giftRequested,
          comment: comment || null,
          created_by: member && member.id ? member.id : null
        });

      if (error) throw error;

      await eventRecap(eventId);
    } catch (error) {
      console.error('ERREUR AJOUT PARTICIPANT EXTERNE :', error);
      alert(error.message || 'Impossible d’ajouter ce participant.');
      if (submitButton) submitButton.disabled = false;
    }
  });
}


/* =========================================================
   SUPPRIMER UN PARTICIPANT EXTERNE
========================================================= */

async function deleteManualEventAttendee(attendeeId, eventId) {
  if (!confirm('Voulez-vous vraiment supprimer ce participant externe ?')) {
    return;
  }

  try {
    const { error } = await db
      .from('event_manual_attendees')
      .delete()
      .eq('id', attendeeId)
      .eq('event_id', eventId);

    if (error) throw error;

    await eventRecap(eventId);
  } catch (error) {
    console.error('ERREUR SUPPRESSION PARTICIPANT EXTERNE :', error);
    alert(error.message || 'Impossible de supprimer ce participant.');
  }
}


/* =========================================================
   DISPONIBILITÉ DES FONCTIONS POUR LES BOUTONS HTML
========================================================= */

window.eventRecap = eventRecap;
window.addManualEventAttendee = addManualEventAttendee;
window.deleteManualEventAttendee = deleteManualEventAttendee;
/* =========================================================
   CALENDRIER
   ========================================================= */

let calendarMonth =
  new Date().getMonth();

let calendarYear =
  new Date().getFullYear();

function calendarTypeLabel(type){

  const labels = {
    reunion: '🔵 Réunion',
    manifestation: '🟢 Manifestation',
    ceremonie: '🟠 Cérémonie',
    amicale: '🟣 Amicale',
    important: '🔴 Important',
    autre: '⚪ Autre'
  };

  return labels[type] || labels.autre;
}


function calendarTypeClass(type){

  return 'calendar-' +
    String(type || 'autre')
      .replace(/[^a-z]/gi,'')
      .toLowerCase();

}


function calendarMonthTitle(year,month){

  return new Date(year,month,1)
    .toLocaleDateString(
      'fr-FR',
      {
        month:'long',
        year:'numeric'
      }
    );

}


async function showCalendar(){

  calendarMonth = new Date().getMonth();
  calendarYear = new Date().getFullYear();

  await renderCalendar(false);

}


async function showCalendarAdmin(){

  if(
    !member ||
    String(member.role).toLowerCase() !== 'admin'
  ){

    alert('Accès administrateur requis.');

    return;
  }

  calendarMonth = new Date().getMonth();
  calendarYear = new Date().getFullYear();

  await renderCalendar(true);

}


async function renderCalendar(isAdmin=false){

  try{

    const firstDay =
      new Date(
        calendarYear,
        calendarMonth,
        1
      );

    const lastDay =
      new Date(
        calendarYear,
        calendarMonth + 1,
        0
      );

    const from =
      `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-01`;

    const to =
      `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;


    const {
      data:events,
      error
    } = await db
      .from('calendar_events')
      .select('*')
      .gte('event_date',from)
      .lte('event_date',to)
      .order('event_date',{ascending:true})
      .order('start_time',{ascending:true});


    if(error) throw error;


    const eventMap = {};


    (events || []).forEach(e => {

      if(!eventMap[e.event_date]){
        eventMap[e.event_date] = [];
      }

      eventMap[e.event_date].push(e);

    });


    const startIndex =
      (firstDay.getDay() + 6) % 7;

    const daysInMonth =
      lastDay.getDate();

    const totalCells =
      Math.ceil(
        (startIndex + daysInMonth) / 7
      ) * 7;


    const today = new Date();

    const todayKey =
      `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;


    let cells = '';


    for(let i=0;i<totalCells;i++){

      const dayNumber =
        i - startIndex + 1;


      if(
        dayNumber < 1 ||
        dayNumber > daysInMonth
      ){

        cells += `
          <div class="calendar-day calendar-empty"></div>
        `;

        continue;
      }


      const key =
        `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(dayNumber).padStart(2,'0')}`;


      const dayEvents =
        eventMap[key] || [];


      const isToday =
        key === todayKey;


      cells += `

        <div class="calendar-day ${isToday ? 'calendar-today' : ''}">

          <div class="calendar-day-number">
            ${dayNumber}
          </div>

          <div class="calendar-events">

            ${dayEvents.map(e => `

              <button
                type="button"
                class="calendar-event ${calendarTypeClass(e.event_type)}"
                onclick="viewCalendarEvent('${e.id}',${isAdmin})">

                ${
                  e.start_time
                    ? `<span>${e.start_time.slice(0,5)}</span> `
                    : ''
                }

                ${esc(e.title)}

              </button>

            `).join('')}

          </div>

        </div>

      `;

    }


    const html = `

      <h2>📅 Calendrier</h2>


      <div
        class="row"
        style="
          justify-content:space-between;
          align-items:center;
          margin:15px 0;
          gap:8px;
        ">

        <button
          type="button"
          class="ghost"
          onclick="calendarPrev(${isAdmin})">

          ⬅️

        </button>


        <strong
          style="
            font-size:20px;
            text-transform:capitalize;
          ">

          ${esc(
            calendarMonthTitle(
              calendarYear,
              calendarMonth
            )
          )}

        </strong>


        <button
          type="button"
          class="ghost"
          onclick="calendarNext(${isAdmin})">

          ➡️

        </button>

      </div>


      <div
        class="row"
        style="
          justify-content:center;
          margin-bottom:12px;
          gap:8px;
        ">

        <button
          type="button"
          class="ghost"
          onclick="calendarToday(${isAdmin})">

          Aujourd'hui

        </button>


        ${
          isAdmin
            ? `
              <button
                type="button"
                class="primary"
                onclick="newCalendarEvent()">

                ➕ Nouvel événement

              </button>
            `
            : ''
        }

      </div>


      <div
        class="calendar-legend"
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:12px;
        ">

        <span>🔵 Réunion</span>
        <span>🟢 Manifestation</span>
        <span>🟠 Cérémonie</span>
        <span>🟣 Amicale</span>
        <span>🔴 Important</span>

      </div>


      <div class="calendar-grid calendar-weekdays">

        ${
          ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']
          .map(d =>
            `<div class="calendar-weekday">${d}</div>`
          )
          .join('')
        }

      </div>


      <div class="calendar-grid">

        ${cells}

      </div>


      ${
        !events?.length
          ? `
            <p
              class="muted"
              style="
                margin-top:15px;
                text-align:center;
              ">

              Aucun événement ce mois-ci.

            </p>
          `
          : ''
      }


      <div
        class="row"
        style="
          justify-content:flex-end;
          margin-top:18px;
        ">

        <button
          type="button"
          class="ghost"
          onclick="closeModal()">

          Fermer

        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR CALENDRIER :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger le calendrier.'
    );

  }

}


async function calendarPrev(isAdmin=false){

  calendarMonth--;

  if(calendarMonth < 0){

    calendarMonth = 11;
    calendarYear--;

  }

  await renderCalendar(isAdmin);

}


async function calendarNext(isAdmin=false){

  calendarMonth++;

  if(calendarMonth > 11){

    calendarMonth = 0;
    calendarYear++;

  }

  await renderCalendar(isAdmin);

}


async function calendarToday(isAdmin=false){

  const now = new Date();

  calendarMonth = now.getMonth();
  calendarYear = now.getFullYear();

  await renderCalendar(isAdmin);

}


async function saveCalendarEvent(){

  try{

    if(
      !member ||
      String(member.role).toLowerCase() !== 'admin'
    ){

      alert('Accès administrateur requis.');

      return;
    }


    const title =
      $('calTitle')?.value.trim() || '';

    const eventDate =
      $('calDate')?.value || '';

    const start =
      $('calStart')?.value || null;

    const end =
      $('calEnd')?.value || null;

    const location =
      $('calLocation')?.value.trim() || null;

    const description =
      $('calDescription')?.value.trim() || null;

    const eventType =
      $('calType')?.value || 'autre';


    if(!title || !eventDate){

      alert(
        'Le titre et la date sont obligatoires.'
      );

      return;
    }


    if(
      start &&
      end &&
      end < start
    ){

      alert(
        "L'heure de fin doit être après l'heure de début."
      );

      return;
    }


    const {
      data:{session}
    } = await db.auth.getSession();


    if(!session?.user?.id){

      alert(
        'Session Supabase inexistante.'
      );

      return;
    }


    const {error} =
      await db
        .from('calendar_events')
        .insert({

          title:title,

          event_date:eventDate,

          start_time:start,

          end_time:end,

          location:location,

          description:description,

          event_type:eventType,

          created_by:session.user.id

        });


    if(error) throw error;


    closeModal();

    alert(
      '✅ Événement créé.'
    );


    await showCalendarAdmin();


  }catch(error){

    console.error(
      'ERREUR CREATION CALENDRIER :',
      error
    );

    alert(
      error.message ||
      "Impossible de créer l'événement."
    );

  }

}

async function viewCalendarEvent(eventId,isAdmin=false){

  try{

    const {
      data:event,
      error
    } = await db
      .from('calendar_events')
      .select('*')
      .eq('id',eventId)
      .maybeSingle();


    if(error) throw error;


    if(!event){

      alert('Événement introuvable.');

      return;

    }


    const dateText =
      event.event_date
        ? new Date(
            event.event_date + 'T00:00:00'
          ).toLocaleDateString(
            'fr-FR',
            {
              weekday:'long',
              day:'numeric',
              month:'long',
              year:'numeric'
            }
          )
        : '';


    const timeText = [

      event.start_time
        ? event.start_time.slice(0,5)
        : '',

      event.end_time
        ? event.end_time.slice(0,5)
        : ''

    ].filter(Boolean).join(' → ');


    openModal(`

      <h2>
        ${esc(event.title || 'Événement')}
      </h2>


      <div
        class="card"
        style="margin-top:15px;">

        <p>

          📅

          <strong>
            ${esc(dateText)}
          </strong>

        </p>


        ${
          timeText

            ? `

              <p>

                🕐

                <strong>
                  ${esc(timeText)}
                </strong>

              </p>

            `

            : ''
        }


        ${
          event.event_type

            ? `

              <p>

                📌

                <strong>
                  ${esc(
                    calendarTypeLabel(
                      event.event_type
                    )
                  )}
                </strong>

              </p>

            `

            : ''
        }


        ${
          event.location

            ? `

              <p>

                📍

                <strong>
                  ${esc(event.location)}
                </strong>

              </p>

            `

            : ''
        }


        ${
          event.description

            ? `

              <hr>

              <p>

                ${esc(event.description)}

              </p>

            `

            : ''
        }

      </div>


      <div
        class="row"
        style="
          margin-top:18px;
          gap:8px;
          flex-wrap:wrap;
        ">


        ${
          isAdmin

            ? `

              <button
                type="button"
                class="primary"
                onclick="
                  editCalendarEvent('${event.id}');
                ">

                ✏️ Modifier

              </button>


              <button
                type="button"
                class="ghost"
                onclick="
                  deleteCalendarEvent('${event.id}');
                ">

                🗑️ Supprimer

              </button>

            `

            : ''
        }


        <button
          type="button"
          class="ghost"
          onclick="closeModal()">

          Fermer

        </button>


      </div>

    `);


  }catch(error){

    console.error(
      'ERREUR AFFICHAGE ÉVÉNEMENT :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger cet événement.'
    );

  }

}

// ============================================================
// ✏️ MODIFIER UN ÉVÉNEMENT DU CALENDRIER
// ============================================================

async function editCalendarEvent(eventId){

  try{

    const {data:event,error} = await db
      .from('calendar_events')
      .select('*')
      .eq('id',eventId)
      .maybeSingle();

    if(error) throw error;

    if(!event){

      alert('Événement introuvable.');

      return;

    }


    const title =
      prompt(
        'Titre de l’événement :',
        event.title || ''
      );

    if(title === null) return;


    const description =
      prompt(
        'Description :',
        event.description || ''
      );

    if(description === null) return;


    const location =
      prompt(
        'Lieu :',
        event.location || ''
      );

    if(location === null) return;


    const {error:updateError} = await db
      .from('calendar_events')
      .update({

        title:title.trim(),

        description:
          description.trim(),

        location:
          location.trim()

      })
      .eq('id',eventId);


    if(updateError){

      throw updateError;

    }


    alert(
      '✅ Événement modifié avec succès.'
    );


    closeModal();


    if(typeof showCalendar === 'function'){

      showCalendar();

    }


  }catch(error){

    console.error(
      'ERREUR MODIFICATION ÉVÉNEMENT :',
      error
    );

    alert(
      error.message ||
      'Impossible de modifier cet événement.'
    );

  }

}


window.editCalendarEvent =
  editCalendarEvent;

// ============================================================
// 🗑️ SUPPRIMER UN ÉVÉNEMENT DU CALENDRIER
// ============================================================

async function deleteCalendarEvent(eventId){

  if(!confirm(
    'Voulez-vous vraiment supprimer cet événement ?'
  )){

    return;

  }


  try{

    const {error} = await db
      .from('calendar_events')
      .delete()
      .eq('id',eventId);


    if(error){

      throw error;

    }


    alert(
      '✅ Événement supprimé.'
    );


    closeModal();


    if(typeof showCalendar === 'function'){

      showCalendar();

    }


  }catch(error){

    console.error(
      'ERREUR SUPPRESSION ÉVÉNEMENT :',
      error
    );

    alert(
      error.message ||
      'Impossible de supprimer cet événement.'
    );

  }

}


window.deleteCalendarEvent =
  deleteCalendarEvent;


function openModal(content){

  let modal = $('appModal');

  if(!modal){

    modal = document.createElement('div');

    modal.id = 'appModal';

    modal.className = 'modal-overlay';

    document.body.appendChild(modal);

  }


  modal.innerHTML = `

    <div class="modal">

      <div class="modal-scroll-content">

        ${content}

      </div>

    </div>

  `;


  modal.classList.add('show');


  // ==========================================================
  // CONTENEUR PRINCIPAL
  // ==========================================================

  modal.style.display = 'flex';

  modal.style.position = 'fixed';

  modal.style.inset = '0';

  modal.style.width = '100%';

  modal.style.height = '100%';

  modal.style.boxSizing = 'border-box';

  modal.style.padding = '20px';

  modal.style.zIndex = '99999';

  modal.style.alignItems = 'center';

  modal.style.justifyContent = 'center';

  modal.style.overflow = 'hidden';


  // ==========================================================
  // FOND DE LA POPUP
  // ==========================================================

  const popup =
    modal.querySelector('.modal');


  if(!popup){

    return;

  }


  popup.style.width = '100%';

  popup.style.maxWidth = '900px';

  popup.style.maxHeight = 'calc(100vh - 40px)';

  popup.style.boxSizing = 'border-box';

  popup.style.margin = 'auto';

  popup.style.display = 'flex';

  popup.style.flexDirection = 'column';

  popup.style.overflow = 'hidden';

  popup.style.minHeight = '0';

  popup.style.borderRadius = '16px';


  // ==========================================================
  // ZONE QUI DÉFILE
  // ==========================================================

  const scrollContent =
    popup.querySelector(
      '.modal-scroll-content'
    );


  if(scrollContent){

    scrollContent.style.width = '100%';

    scrollContent.style.maxWidth = '100%';

    scrollContent.style.boxSizing = 'border-box';

    scrollContent.style.overflowY = 'auto';

    scrollContent.style.overflowX = 'hidden';

    scrollContent.style.maxHeight = 'calc(100vh - 40px)';

    scrollContent.style.minHeight = '0';

    scrollContent.style.boxSizing = 'border-box';

    scrollContent.style.webkitOverflowScrolling = 'touch';

    scrollContent.style.overscrollBehavior = 'contain';

    scrollContent.style.paddingRight = '4px';

  }


  // ==========================================================
  // EMPÊCHE LA PAGE DERRIÈRE DE DÉFILER
  // ==========================================================

  document.body.style.overflow = 'hidden';


  // ==========================================================
  // PETITS ÉCRANS
  // ==========================================================

  if(window.innerWidth <= 600){

    modal.style.padding = '10px';


    popup.style.maxHeight =
      'calc(100vh - 20px)';


    scrollContent.style.maxHeight =
      'calc(100vh - 20px)';

  }

}




// =========================================================
// FONCTION D'IMPRESSION
// =========================================================


function printCurrentModal(){

  const modal = $('appModal');

  if(!modal){
    alert('Aucune fenêtre à imprimer.');
    return;
  }

  const content = modal.querySelector('.modal');

  if(!content){
    alert('Aucun contenu à imprimer.');
    return;
  }

  const clone = content.cloneNode(true);

  // Supprimer les boutons
  clone.querySelectorAll('button').forEach(button=>{
    button.remove();
  });

  // Remplacer les cases à cocher
  clone.querySelectorAll('input[type="checkbox"]').forEach(input=>{
    const box = document.createElement('span');
    box.textContent = input.checked ? '☑' : '☐';
    input.replaceWith(box);
  });

  // =====================================================
  // PAGINATION MANUELLE DES TABLEAUX
  // =====================================================

  const originalTable = clone.querySelector('table');

  if(originalTable){

    const originalBody = originalTable.querySelector('tbody');
    const rows = originalBody
      ? Array.from(originalBody.querySelectorAll('tr'))
      : [];

    if(rows.length > 12){

      const fragment = document.createDocumentFragment();

      for(let i = 0; i < rows.length; i += 12){

        const tablePage = originalTable.cloneNode(true);
        const body = tablePage.querySelector('tbody');

        body.innerHTML = '';

        rows.slice(i, i + 12).forEach(row=>{
          body.appendChild(row.cloneNode(true));
        });

        tablePage.classList.add('print-table-page');

        if(i > 0){
          tablePage.classList.add('print-next-page');
        }

        fragment.appendChild(tablePage);
      }

      originalTable.replaceWith(fragment);
    }
  }

  // =====================================================
  // OUVERTURE DE LA FENÊTRE D'IMPRESSION
  // =====================================================

  const printWindow = window.open(
    '',
    '_blank',
    'width=1000,height=800'
  );

  if(!printWindow){
    alert('La fenêtre d’impression a été bloquée par le navigateur.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Impression</title>

      <style>

        @page{
          size:A4 portrait;
          margin:12mm;
        }

        *{
          box-sizing:border-box;
        }

        html,
        body{
          margin:0;
          padding:0;
          height:auto !important;
          overflow:visible !important;
          font-family:Arial,Helvetica,sans-serif;
          color:#111;
          background:#fff;
          font-size:12px;
        }

        h1,h2,h3,h4{
          color:#111;
        }

       .modal,
.modal-scroll-content,
.table-wrap{
  position:static !important;
  display:block !important;
  width:100% !important;
  height:auto !important;
  min-height:0 !important;
  max-height:none !important;
  overflow:visible !important;
  transform:none !important;
  box-sizing:border-box !important;
}

        table{
          width:100%;
          border-collapse:collapse;
          margin-top:12px;
          table-layout:auto;
          page-break-inside:avoid !important;
          break-inside:avoid !important;
        }

        thead{
          display:table-header-group;
        }

        tbody{
          display:table-row-group;
        }

        th,
        td{
          border:1px solid #999;
          padding:7px;
          text-align:left;
          color:#111;
        }

        th{
          background:#eee !important;
          font-weight:bold;
        }

        tr{
          page-break-inside:avoid !important;
          break-inside:avoid !important;
        }

        .print-next-page{
          page-break-before:always !important;
          break-before:page !important;
        }

        .card{
          border:1px solid #bbb;
          padding:12px;
          margin-bottom:10px;
          page-break-inside:avoid;
        }

        button{
          display:none !important;
        }

      </style>
    </head>

    <body>
      ${clone.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = function(){
    printWindow.print();
  };

}

// =========================================================
// FERMETURE POPUP
// =========================================================

function closeModal(){

  const modal = $('appModal');

  if(!modal){

    document.body.style.overflow = '';

    return;

  }


  modal.classList.remove('show');

  modal.remove();

  document.body.style.overflow = '';


  // 🔔 Marquer toutes les notifications comme lues
  markAllNotificationsAsRead();

}

window.closeModal =
  closeModal;

function newCalendarEvent(){

  if(
    !member ||
    String(member.role).toLowerCase() !== 'admin'
  ){
    alert('Accès administrateur requis.');
    return;
  }

  openModal(`
    <h2>➕ Nouvel événement</h2>

    <div class="form-grid">

      <div class="full-col">
        <label>Titre</label>
        <input
          id="calTitle"
          class="input"
          placeholder="Ex : Réunion mensuelle">
      </div>

      <div>
        <label>Date</label>
        <input
          id="calDate"
          class="input"
          type="date"
          value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div>
        <label>Type</label>
        <select id="calType" class="select">
          <option value="reunion">🔵 Réunion</option>
          <option value="manifestation">🟢 Manifestation</option>
          <option value="ceremonie">🟠 Cérémonie</option>
          <option value="amicale">🟣 Amicale</option>
          <option value="important">🔴 Important</option>
          <option value="autre">⚪ Autre</option>
        </select>
      </div>

      <div>
        <label>Heure début</label>
        <input
          id="calStart"
          class="input"
          type="time">
      </div>

      <div>
        <label>Heure fin</label>
        <input
          id="calEnd"
          class="input"
          type="time">
      </div>

      <div class="full-col">
        <label>Lieu</label>
        <input
          id="calLocation"
          class="input"
          placeholder="Lieu">
      </div>

      <div class="full-col">
        <label>Description</label>
        <textarea
          id="calDescription"
          class="textarea"
          placeholder="Description de l'événement"></textarea>
      </div>

    </div>

    <div
      class="row"
      style="margin-top:18px;gap:8px;">

      <button
        type="button"
        class="primary"
        onclick="saveCalendarEvent()">

        💾 Créer l'événement

      </button>

      <button
        type="button"
        class="ghost"
        onclick="closeModal()">

        Annuler

      </button>

    </div>
  `);
}

// =========================================================
// 💬 NOUVELLE MESSAGERIE
// =========================================================

// ---------------------------------------------------------
// VARIABLES
// ---------------------------------------------------------

let currentConversationId = null;


// =========================================================
// 👤 MEMBRE CONNECTÉ
// =========================================================

function getCurrentMemberId(){

  if(!member?.id){

    alert('Vous devez être connecté.');

    return null;

  }

  return member.id;

}

async function updateConversationUnreadBadge(){

  const badge =
    $('conversationUnreadBadge');

  if(!badge)
    return;


  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId)
    return;


  try{

    const {
      data: participations,
      error: participationError
    } =
      await db
        .from('conversation_participants')
        .select(`
          conversation_id,
          last_read_at
        `)
        .eq(
          'member_id',
          currentMemberId
        )
        .is(
          'deleted_at',
          null
        );


    if(participationError)
      throw participationError;


    if(!participations?.length){

      badge.style.display =
        'none';

      return;

    }


    let unreadCount = 0;


    for(
      const participation
      of participations
    ){

      let query =
        db
          .from('conversation_messages')
          .select(
            'id',
            {
              count:'exact',
              head:true
            }
          )
          .eq(
            'conversation_id',
            participation.conversation_id
          )
          .neq(
            'sender_id',
            currentMemberId
          );


      if(
        participation.last_read_at
      ){

        query =
          query.gt(
            'created_at',
            participation.last_read_at
          );

      }


      const {
        count,
        error
      } =
        await query;


      if(error)
        throw error;


      unreadCount +=
        count || 0;

    }


    if(unreadCount > 0){

      badge.textContent =
        unreadCount > 99
          ? '99+'
          : unreadCount;

      badge.style.display =
        'block';

    }
    else{

      badge.style.display =
        'none';

    }


  }catch(error){

    console.error(
      'ERREUR BADGE MESSAGERIE :',
      error
    );

  }

}



// =========================================================
// 💬 OUVRIR LA MESSAGERIE
// =========================================================

async function openMessaging(){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId) return;


  try{

    // -----------------------------------------------------
    // Récupération des participations
    // -----------------------------------------------------

    const {data:participations,error:participationError} =
      await db
        .from('conversation_participants')
        .select(`
          id,
          conversation_id,
          member_id,
          joined_at,
          deleted_at,
          last_read_at
        `)
        .eq(
          'member_id',
          currentMemberId
        )
        .is(
          'deleted_at',
          null
        );


    if(participationError)
      throw participationError;


    const myParticipations =
      participations || [];


    // -----------------------------------------------------
    // Aucune conversation
    // -----------------------------------------------------

    if(!myParticipations.length){

      openModal(`

        <h2>
          💬 Messagerie
        </h2>

        <div class="card">

          <p>
            📭 Aucune conversation.
          </p>

          <button
            type="button"
            class="primary"
            onclick="openNewConversation()"
          >
            ➕ Nouvelle conversation
          </button>

        </div>

        <div
          class="row"
          style="margin-top:15px;"
        >

          <button
            type="button"
            class="primary"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>

      `);

      return;

    }


    // -----------------------------------------------------
    // Conversations
    // -----------------------------------------------------

    const conversationIds =
      myParticipations.map(
        p => p.conversation_id
      );


    const {data:conversations,error:conversationError} =
      await db
        .from('conversations')
        .select(`
          id,
          type,
          created_by,
          created_at
        `)
        .in(
          'id',
          conversationIds
        )
        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(conversationError)
      throw conversationError;


    const conversationList =
      conversations || [];


    // -----------------------------------------------------
    // Participants des conversations
    // -----------------------------------------------------

    const {data:allParticipants,error:participantsError} =
      await db
        .from('conversation_participants')
        .select(`
          id,
          conversation_id,
          member_id,
          joined_at,
          deleted_at
        `)
        .in(
          'conversation_id',
          conversationIds
        );


    if(participantsError)
      throw participantsError;


    const participants =
      allParticipants || [];


    // -----------------------------------------------------
    // Membres
    // -----------------------------------------------------

    const memberIds = [
      ...new Set(
        participants.map(
          p => p.member_id
        )
      )
    ];


    const {data:membersData,error:membersError} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          role,
          bureau_member
        `)
        .in(
          'id',
          memberIds
        );


    if(membersError)
      throw membersError;


    const membersDataSafe =
      membersData || [];


    // -----------------------------------------------------
    // Derniers messages
    // -----------------------------------------------------

    const {data:lastMessages,error:lastMessagesError} =
      await db
        .from('conversation_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at
        `)
        .in(
          'conversation_id',
          conversationIds
        )
        .order(
          'created_at',
          {
            ascending:false
          }
        );


    if(lastMessagesError)
      throw lastMessagesError;


    const messages =
      lastMessages || [];


    // -----------------------------------------------------
    // Construction de la liste
    // -----------------------------------------------------

    const conversationCards =
      conversationList.map(conversation => {

        const myParticipation =
          myParticipations.find(
            p =>
              String(p.conversation_id) ===
              String(conversation.id)
          );


        const conversationParticipants =
          participants.filter(
            p =>
              String(p.conversation_id) ===
              String(conversation.id) &&
              !p.deleted_at
          );


        const otherParticipants =
          conversationParticipants.filter(
            p =>
              String(p.member_id) !==
              String(currentMemberId)
          );


        let conversationTitle =
          'Conversation';


        // -----------------------------------------------
        // NOM DE LA CONVERSATION
        // -----------------------------------------------

        if(conversation.type === 'all'){

          conversationTitle =
            '👥 Tous les membres';

        }

        else if(conversation.type === 'bureau'){

          conversationTitle =
            '🏛️ Bureau Amicale';

        }

 else if(
  conversation.type === 'direct'
){

  const names =
    otherParticipants
      .map(p => {

        const m =
          membersDataSafe.find(
            x =>
              String(x.id) ===
              String(p.member_id)
          );

        return m
          ? `${m.first_name || ''} ${m.last_name || ''}`.trim()
          : '';

      })
      .filter(Boolean);


  if(names.length){

    conversationTitle =
      names.join(', ');

  }
  else{

    conversationTitle =
      '💬 Conversation';

  }

}

        else{

          const names =
            otherParticipants
              .map(p => {

                const m =
                  membersDataSafe.find(
                    x =>
                      String(x.id) ===
                      String(p.member_id)
                  );

                return m
                  ? `${m.first_name || ''} ${m.last_name || ''}`.trim()
                  : '';

              })
              .filter(Boolean);


          if(names.length){

            conversationTitle =
              names.join(', ');

          }

        }


        // -----------------------------------------------
        // DERNIER MESSAGE
        // -----------------------------------------------

        const lastMessage =
          messages.find(
            msg =>
              String(msg.conversation_id) ===
              String(conversation.id)
          );


        let preview =
          'Nouvelle conversation';


        let dateText =
          '';


        if(lastMessage){

          preview =
            lastMessage.content || '';


          dateText =
            fmtDate(
              lastMessage.created_at
            );

        }


        // -----------------------------------------------
        // NON LU
        // -----------------------------------------------

        let unread = false;


        if(
          lastMessage &&
          myParticipation?.last_read_at
        ){

          unread =
            new Date(
              lastMessage.created_at
            ) >
            new Date(
              myParticipation.last_read_at
            );

        }
        else if(lastMessage){

          unread = true;

        }


        return `

          <div
            class="card"
            onclick="
              openConversation(
                '${conversation.id}'
              );
            "
            style="
              margin-bottom:10px;
              cursor:pointer;
            "
          >

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                align-items:center;
              "
            >

              <h3
                style="
                  margin:0;
                "
              >

                ${esc(
                  conversationTitle
                )}

              </h3>


              ${
                unread

                  ? `

                    <span
                      style="
                        font-size:12px;
                        font-weight:bold;
                      "
                    >
                      🔴
                    </span>

                  `

                  : ''
              }

            </div>


            <div
              style="
                margin-top:6px;
                font-size:14px;
                opacity:.75;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
              "
            >

              ${esc(
                preview
              )}

            </div>


            ${
              dateText

                ? `

                  <small
                    class="muted"
                    style="
                      display:block;
                      margin-top:5px;
                    "
                  >

                    ${dateText}

                  </small>

                `

                : ''
            }

          </div>

        `;

      }).join('');


    // -----------------------------------------------------
    // AFFICHAGE
    // -----------------------------------------------------

    openModal(`

      <h2>
        💬 Messagerie
      </h2>


      <div>

        ${
          conversationCards ||
          `
            <div class="card">
              📭 Aucune conversation.
            </div>
          `
        }

      </div>


      <button
        type="button"
        class="primary"
        onclick="openNewConversation()"
        style="
          width:100%;
          margin-top:10px;
        "
      >

        ➕ Nouvelle conversation

      </button>


      <div
        class="row"
        style="
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `);

    await updateConversationUnreadBadge();
  }catch(error){

    console.error(
      'ERREUR MESSAGERIE :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger la messagerie.'
    );

  }

}


// =========================================================
// ➕ NOUVELLE CONVERSATION
// =========================================================

async function openNewConversation(){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId) return;


  try{

    const {data:membersData,error} =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          role,
          bureau_member,
          active
        `)
        .eq(
          'active',
          true
        )
        .order(
          'last_name',
          {
            ascending:true
          }
        );


    if(error)
      throw error;


    const membersList =
      membersData || [];


    const isAdmin =
      member?.role === 'admin';


    openModal(`

      <h2>
        ➕ Nouvelle conversation
      </h2>


      <label
        style="
          display:block;
          margin-bottom:6px;
          font-weight:600;
        "
      >

        Destinataire

      </label>


      <select
        id="newConversationType"
        onchange="toggleNewConversationTarget()"
        style="
          width:100%;
          margin-bottom:12px;
        "
      >

        <option value="member">
          👤 Un membre
        </option>

        <option value="admin">
          👑 Administrateur
        </option>

        <option value="bureau">
          🏛️ Bureau Amicale
        </option>

        ${
          isAdmin

            ? `

              <option value="all">
                👥 Tous les membres
              </option>

            `

            : ''
        }

      </select>


      <select
        id="newConversationMember"
        style="
          width:100%;
          margin-bottom:12px;
        "
      >

        <option value="">
          Sélectionner un membre...
        </option>

        ${
          membersList
            .filter(
              m =>
                String(m.id) !==
                String(currentMemberId) &&
                m.role !== 'admin'
            )
            .map(m => `

              <option
                value="${m.id}"
              >

                ${esc(
                  `${m.first_name || ''} ${m.last_name || ''}`.trim()
                )}

              </option>

            `)
            .join('')
        }

      </select>


      <textarea
        id="newConversationMessage"
        rows="4"
        placeholder="Écrivez votre message..."
        style="
          width:100%;
          resize:vertical;
        "
      ></textarea>


      <button
        type="button"
        class="primary"
        onclick="createConversation()"
        style="
          width:100%;
          margin-top:10px;
        "
      >

        📨 Créer la conversation

      </button>


      <button
        type="button"
        class="secondary"
        onclick="openMessaging()"
        style="
          width:100%;
          margin-top:10px;
        "
      >

        Retour

      </button>

    `);

  }catch(error){

    console.error(
      'ERREUR NOUVELLE CONVERSATION :',
      error
    );

    alert(
      error.message ||
      'Impossible de préparer la conversation.'
    );

  }

}


// =========================================================
// 🔄 AFFICHAGE DU CHOIX DU MEMBRE
// =========================================================

function toggleNewConversationTarget(){

  const type =
    $('newConversationType')?.value;


  const select =
    $('newConversationMember');


  if(!select)
    return;


  if(
    type === 'member'
  ){

    select.style.display =
      'block';

  }
  else{

    select.style.display =
      'none';

  }

}


// =========================================================
// ➕ CRÉATION D'UNE CONVERSATION
// =========================================================

async function createConversation(){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId) return;


  try{

    const type =
      $('newConversationType')?.value;


    const targetMemberId =
      $('newConversationMember')?.value;


    const content =
      ($('newConversationMessage')?.value || '')
        .trim();


    if(
      type === 'member' &&
      !targetMemberId
    ){

      alert(
        'Sélectionnez un membre.'
      );

      return;

    }


    if(!content){

      alert(
        'Écrivez un message.'
      );

      return;

    }


    // -----------------------------------------------------
    // Création conversation
    // -----------------------------------------------------

  // =====================================================
// TYPE COMPATIBLE AVEC LA BASE
// =====================================================

let conversationType = 'direct';

if(type === 'all'){

  conversationType = 'all';

}
else if(type === 'bureau'){

  conversationType = 'bureau';

}
else if(
  type === 'member' ||
  type === 'admin'
){

  conversationType = 'direct';

}


const {data:conversation,error:conversationError} =
  await db
    .from('conversations')
    .insert({

      type:
        conversationType,

      created_by:
        currentMemberId

    })
    .select()
    .single();


    if(conversationError)
      throw conversationError;


    // -----------------------------------------------------
    // Participants
    // -----------------------------------------------------

    let participantIds = [
      currentMemberId
    ];


    // -----------------------------------------------
    // MEMBRE PRÉCIS
    // -----------------------------------------------

    if(
      type === 'member'
    ){

      participantIds.push(
        targetMemberId
      );

    }


    // -----------------------------------------------
    // ADMIN
    // -----------------------------------------------

    else if(
      type === 'admin'
    ){

      const {data:admins,error:adminsError} =
        await db
          .from('members')
          .select('id')
          .eq(
            'role',
            'admin'
          )
          .eq(
            'active',
            true
          );


      if(adminsError)
        throw adminsError;


      (admins || []).forEach(
        a => {

          if(
            String(a.id) !==
            String(currentMemberId)
          ){

            participantIds.push(
              a.id
            );

          }

        }
      );

    }


    // -----------------------------------------------
    // BUREAU
    // -----------------------------------------------

    else if(
      type === 'bureau'
    ){

      const {data:bureau,error:bureauError} =
        await db
          .from('members')
          .select('id')
          .eq(
            'bureau_member',
            true
          )
          .eq(
            'active',
            true
          );


      if(bureauError)
        throw bureauError;


      (bureau || []).forEach(
        m => {

          if(
            !participantIds.includes(
              m.id
            )
          ){

            participantIds.push(
              m.id
            );

          }

        }
      );

    }


    // -----------------------------------------------
    // TOUS
    // -----------------------------------------------

    else if(
      type === 'all'
    ){

      const {data:allMembers,error:allError} =
        await db
          .from('members')
          .select('id')
          .eq(
            'active',
            true
          );


      if(allError)
        throw allError;


      (allMembers || []).forEach(
        m => {

          if(
            !participantIds.includes(
              m.id
            )
          ){

            participantIds.push(
              m.id
            );

          }

        }
      );

    }


    // -----------------------------------------------------
    // Suppression doublons
    // -----------------------------------------------------

    participantIds =
      [
        ...new Set(
          participantIds
        )
      ];


    // -----------------------------------------------------
    // Insertion participants
    // -----------------------------------------------------

    const participantRows =
      participantIds.map(
        id => ({

          conversation_id:
            conversation.id,

          member_id:
            id

        })
      );


    const {
      error:participantsError
    } =
      await db
        .from('conversation_participants')
        .insert(
          participantRows
        );


    if(participantsError)
      throw participantsError;

/* =====================================================
   📜 HISTORIQUE — CRÉATION CONVERSATION
   ===================================================== */

try {

  // Récupération des noms des participants
  const { data: historyMembers, error: historyMembersError } =
    await db
      .from('members')
      .select('id, first_name, last_name')
      .in('id', participantIds);

  if(historyMembersError){
    console.error(
      'ERREUR RÉCUPÉRATION DESTINATAIRES HISTORIQUE :',
      historyMembersError
    );
  }

  const sender =
    (historyMembers || []).find(
      m => String(m.id) === String(currentMemberId)
    );

  const recipients =
    (historyMembers || [])
      .filter(
        m => String(m.id) !== String(currentMemberId)
      )
      .map(
        m =>
          `${m.first_name || ''} ${m.last_name || ''}`.trim()
      )
      .filter(Boolean);

  const senderName =
    `${sender?.first_name || ''} ${sender?.last_name || ''}`.trim();

  await db
    .from('system_history')
    .insert({

      admin_user_id:
        currentMemberId,

      category:
  'messaging',

action:
  'Nouvelle conversation',

      description:
        `Expéditeur : ${senderName || 'Inconnu'}\n` +
        `Destinataire(s) : ${
          recipients.length
            ? recipients.join(', ')
            : 'Aucun destinataire'
        }`,

      severity:
        'info',

      metadata: {

        conversation_id:
          conversation.id,

        sender_id:
          currentMemberId,

        sender_name:
          senderName,

        recipient_ids:
          participantIds.filter(
            id =>
              String(id) !==
              String(currentMemberId)
          ),

        recipients:
          recipients,

        created_at:
          conversation.created_at ||
          new Date().toISOString()

      }

    });

} catch(historyError){

  console.error(
    'ERREUR HISTORIQUE CONVERSATION :',
    historyError
  );

}
    // -----------------------------------------------------
    // Premier message
    // -----------------------------------------------------

    const {
      error:messageError
    } =
      await db
        .from('conversation_messages')
        .insert({

          conversation_id:
            conversation.id,

          sender_id:
            currentMemberId,

          content:
            content

        });


    if(messageError)
      throw messageError;

/* =====================================================
   📧 EMAIL — NOUVELLE CONVERSATION
   ===================================================== */

/* =====================================================
   📧 EMAIL — UNIQUEMENT SI UN ADMIN EST DESTINATAIRE
   ===================================================== */

try{

  const {
    data: adminRecipients,
    error: adminRecipientsError
  } = await db
    .from('members')
    .select('id')
    .in('id', participantIds)
    .eq('role', 'admin')
    .eq('active', true);


  if(adminRecipientsError){

    console.error(
      'ERREUR VÉRIFICATION DESTINATAIRES ADMIN :',
      adminRecipientsError
    );

  }else if(
    (adminRecipients || []).some(
      admin =>
        String(admin.id) !==
        String(currentMemberId)
    )
  ){

    await sendAdminEmailNotification(
      'message',
      '💬 Nouvelle conversation',

      `Un membre vient de créer une nouvelle conversation.

Message :

${content}`,

      `${member?.first_name || ''} ${member?.last_name || ''}`.trim()
    );

  }

}catch(emailError){

  console.error(
    'ERREUR EMAIL NOUVELLE CONVERSATION :',
    emailError
  );

}

    
    // -----------------------------------------------------
    // Ouverture immédiate
    // -----------------------------------------------------
const {
  data: pushData,
  error: pushError
} =
  await db.functions.invoke(
    'send-push',
    {
      body: {

        conversation_id:
          conversation.id,

        sender_id:
          currentMemberId,

        title:
          '💬 Nouveau message',

        message:
          content

      }
    }
  );


console.log(
  '🔔 SEND-PUSH CONVERSATION :',
  pushData
);


if(pushError){

  console.error(
    '❌ ERREUR SEND-PUSH CONVERSATION :',
    pushError
  );

}

    
    await openConversation(
      conversation.id
    );


  }catch(error){

    console.error(
      'ERREUR CRÉATION CONVERSATION :',
      error
    );


    alert(
      error.message ||
      'Impossible de créer la conversation.'
    );

  }

}


// =========================================================
// 💬 OUVRIR UNE CONVERSATION
// =========================================================

async function openConversation(
  conversationId
){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId) return;


  currentConversationId =
    conversationId;


  try{

    // -----------------------------------------------------
    // Conversation
    // -----------------------------------------------------

    const {
      data:conversation,
      error:conversationError
    } =
      await db
        .from('conversations')
        .select(`
          id,
          type,
          created_by,
          created_at
        `)
        .eq(
          'id',
          conversationId
        )
        .single();


    if(conversationError)
      throw conversationError;


    // -----------------------------------------------------
    // Participants
    // -----------------------------------------------------

    const {
      data:participants,
      error:participantsError
    } =
      await db
        .from('conversation_participants')
        .select(`
          id,
          conversation_id,
          member_id,
          joined_at,
          deleted_at,
          last_read_at
        `)
        .eq(
          'conversation_id',
          conversationId
        )
        .is(
          'deleted_at',
          null
        );


    if(participantsError)
      throw participantsError;


    const participantList =
      participants || [];


    // -----------------------------------------------------
    // Membres
    // -----------------------------------------------------

    const memberIds =
      participantList.map(
        p => p.member_id
      );


    const {
      data:membersData,
      error:membersError
    } =
      await db
        .from('members')
        .select(`
          id,
          first_name,
          last_name,
          role,
          bureau_member
        `)
        .in(
          'id',
          memberIds
        );


    if(membersError)
      throw membersError;


    const membersList =
      membersData || [];


    // -----------------------------------------------------
    // Messages
    // -----------------------------------------------------

    const {
      data:messages,
      error:messagesError
    } =
      await db
        .from('conversation_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at
        `)
        .eq(
          'conversation_id',
          conversationId
        )
        .order(
          'created_at',
          {
            ascending:true
          }
        );


    if(messagesError)
      throw messagesError;


    // -----------------------------------------------------
    // TITRE
    // -----------------------------------------------------

    let title =
      'Conversation';


    if(conversation.type === 'all'){

      title =
        '👥 Tous les membres';

    }
    else if(conversation.type === 'bureau'){

      title =
        '🏛️ Bureau Amicale';

    }
else if(
  conversation.type === 'direct'
){

  const names =
    participantList
      .filter(
        p =>
          String(p.member_id) !==
          String(currentMemberId)
      )
      .map(
        p => {

          const m =
            membersList.find(
              x =>
                String(x.id) ===
                String(p.member_id)
            );

          return m
            ? `${m.first_name || ''} ${m.last_name || ''}`.trim()
            : '';

        }
      )
      .filter(Boolean);


  if(names.length){

    title =
      names.join(', ');

  }
  else{

    title =
      '💬 Conversation';

  }

}
    else{

      const names =
        participantList
          .filter(
            p =>
              String(p.member_id) !==
              String(currentMemberId)
          )
          .map(
            p => {

              const m =
                membersList.find(
                  x =>
                    String(x.id) ===
                    String(p.member_id)
                );

              return m
                ? `${m.first_name || ''} ${m.last_name || ''}`.trim()
                : '';

            }
          )
          .filter(Boolean);


      if(names.length)
        title =
          names.join(', ');

    }


    // -----------------------------------------------------
    // AFFICHAGE DES MESSAGES
    // -----------------------------------------------------

    const messageHtml =
      (messages || [])
        .map(
          msg => {

            const mine =
              String(msg.sender_id) ===
              String(currentMemberId);


            const sender =
              membersList.find(
                m =>
                  String(m.id) ===
                  String(msg.sender_id)
              );


            const senderName =
              sender
                ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
                : 'Membre';


            return `

              <div
                style="
                  display:flex;
                  justify-content:
                    ${mine
                      ? 'flex-end'
                      : 'flex-start'};
                  margin-bottom:8px;
                "
              >

                <div
                  style="
                    max-width:80%;
                    padding:9px 12px;
                    border-radius:15px;
                    background:
                      ${mine
                        ? 'var(--primary, #2563eb)'
                        : 'var(--card, #eee)'};
                    color:
                      ${mine
                        ? '#fff'
                        : 'inherit'};
                  "
                >

                  ${
                    !mine

                      ? `

                        <div
                          style="
                            font-size:11px;
                            font-weight:600;
                            margin-bottom:3px;
                          "
                        >

                          ${esc(
                            senderName
                          )}

                        </div>

                      `

                      : ''
                  }


                  <div>

                    ${esc(
                      msg.content
                    )}

                  </div>


                  <div
                    style="
                      font-size:10px;
                      opacity:.65;
                      margin-top:4px;
                      text-align:right;
                    "
                  >

                    ${fmtDate(
                      msg.created_at
                    )}

                  </div>

                </div>

              </div>

            `;

          }
        )
        .join('');


    // -----------------------------------------------------
    // AFFICHAGE
    // -----------------------------------------------------

    openModal(`

      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="openMessaging()"
        >
          ←
        </button>


        <h2
          style="
            margin:0;
          "
        >

          ${esc(title)}

        </h2>

      </div>


      <div
        style="
          max-height:55vh;
          overflow-y:auto;
          padding:10px 2px;
          margin-top:10px;
        "
      >

        ${
          messageHtml ||

          `

            <div class="card">
              Aucun message.
            </div>

          `
        }

      </div>


      <div
        style="
          display:flex;
          gap:7px;
          align-items:flex-end;
          margin-top:10px;
        "
      >

        <textarea
          id="conversationMessageInput"
          rows="2"
          placeholder="Écrire un message..."
          style="
            flex:1;
            resize:none;
          "
        ></textarea>


        <button
          type="button"
          class="primary"
          onclick="sendConversationMessage()"
          style="
            min-width:48px;
          "
        >

          ➤

        </button>

      </div>


      <button
        type="button"
        class="secondary"
        onclick="
          deleteConversationForMe(
            '${conversationId}'
          );
        "
        style="
          width:100%;
          margin-top:10px;
        "
      >

        🗑️ Supprimer la conversation pour moi

      </button>

    `);


    // -----------------------------------------------------
    // MARQUER COMME LU
    // -----------------------------------------------------

    await markConversationAsRead(
      conversationId
    );


  }catch(error){

    console.error(
      'ERREUR OUVERTURE CONVERSATION :',
      error
    );


    alert(
      error.message ||
      'Impossible d’ouvrir la conversation.'
    );

  }

}


// =========================================================
// 📨 ENVOYER UN MESSAGE
// =========================================================

async function sendConversationMessage(){

  const currentMemberId =
    getCurrentMemberId();

  if(
    !currentMemberId ||
    !currentConversationId
  ){

    return;

  }

  const input =
    $('conversationMessageInput');

  const content =
    (input?.value || '')
      .trim();

  if(!content)
    return;


  try{

    const {
      error
    } =
      await db
        .from('conversation_messages')
        .insert({

          conversation_id:
            currentConversationId,

          sender_id:
            currentMemberId,

          content:
            content

        });


    if(error)
      throw error;


    // ============================================
    // NOTIFICATION DES AUTRES PARTICIPANTS
    // ============================================

    const {
      data: pushData,
      error: pushError
    } =
      await db.functions.invoke(
        'send-push',
        {
          body: {

            conversation_id:
              currentConversationId,

            sender_id:
              currentMemberId,

            title:
              '💬 Nouveau message',

            message:
              content

          }
        }
      );


    console.log(
      '🔔 SEND-PUSH :',
      pushData
    );


    if(pushError){

      console.error(
        '❌ ERREUR SEND-PUSH :',
        pushError
      );

    }


    input.value =
      '';


    await openConversation(
      currentConversationId
    );


  }catch(error){

    console.error(
      'ERREUR ENVOI MESSAGE :',
      error
    );

    alert(
      error.message ||
      'Impossible d’envoyer le message.'
    );

  }

}
// =========================================================
// 👁️ MARQUER UNE CONVERSATION COMME LUE
// =========================================================

async function markConversationAsRead(
  conversationId
){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId)
    return;


  try{

    const {
      error
    } =
      await db
        .from('conversation_participants')
        .update({

          last_read_at:
            new Date().toISOString()

        })
        .eq(
          'conversation_id',
          conversationId
        )
        .eq(
          'member_id',
          currentMemberId
        );


    if(error)
      console.error(
        'ERREUR MARQUAGE LU :',
        error
      );


  }catch(error){

    console.error(
      'ERREUR READ :',
      error
    );

  }

}


// =========================================================
// 🗑️ SUPPRIMER UNE CONVERSATION POUR SOI
// =========================================================

async function deleteConversationForMe(
  conversationId
){

  const currentMemberId =
    getCurrentMemberId();

  if(!currentMemberId)
    return;


  const confirmed =
    confirm(
      'Supprimer cette conversation pour vous ?\n\nElle restera visible pour les autres participants.'
    );


  if(!confirmed)
    return;


  try{

    const {
      error
    } =
      await db
        .from('conversation_participants')
        .update({

          deleted_at:
            new Date().toISOString()

        })
        .eq(
          'conversation_id',
          conversationId
        )
        .eq(
          'member_id',
          currentMemberId
        );


    if(error)
      throw error;


    currentConversationId =
      null;


    await openMessaging();


  }catch(error){

    console.error(
      'ERREUR SUPPRESSION CONVERSATION :',
      error
    );


    alert(
      error.message ||
      'Impossible de supprimer la conversation.'
    );

  }

}
// ============================================================
// 🧭 GESTION DES TOURNÉES DE CALENDRIER
// ============================================================

async function manageCalendarTours(){

  try{

    // ========================================================
    // RÉCUPÉRATION DES DONNÉES
    // ========================================================

    const [
      citiesRes,
      sectorsRes,
      assignmentsRes,
      membersRes
    ] = await Promise.all([

      db
        .from('calendar_cities')
        .select('*')
        .order('name',{ascending:true}),

      db
        .from('calendar_sectors')
        .select('*')
        .order('name',{ascending:true}),

      db
        .from('calendar_assignments')
        .select('*'),

      db
        .from('members')
        .select('id,first_name,last_name,active,role')
        .eq('active',true)
        .order('last_name',{ascending:true})

    ]);


    if(citiesRes.error) throw citiesRes.error;
    if(sectorsRes.error) throw sectorsRes.error;
    if(assignmentsRes.error) throw assignmentsRes.error;
    if(membersRes.error) throw membersRes.error;


    const cities =
      citiesRes.data || [];

    const sectors =
      sectorsRes.data || [];

    const assignments =
      assignmentsRes.data || [];

    const members =
      membersRes.data || [];


    // ========================================================
    // INDEX RAPIDES
    // ========================================================

    const memberMap = {};

    members.forEach(m => {

      memberMap[String(m.id)] = m;

    });


    const cityMap = {};

    cities.forEach(c => {

      cityMap[String(c.id)] = c;

    });


    const sectorMap = {};

    sectors.forEach(s => {

      sectorMap[String(s.id)] = s;

    });


    // ========================================================
    // STATISTIQUES
    // ========================================================

    const totalSectors =
      sectors.length;

    const totalMembersAssigned =
      new Set(
        assignments.map(a => String(a.member_id))
      ).size;

    const totalCalendars =
      assignments.reduce(
        (total,a) =>
          total +
          Number(a.calendar_count || 0),
        0
      );


    // ========================================================
    // CARTE COMMUNE
    // ========================================================

    const cityCards =
      cities.length

        ? cities.map(city => {

            const citySectors =
              sectors.filter(
                s =>
                  String(s.city_id) ===
                  String(city.id)
              );


            const cityAssignments =
              assignments.filter(a =>
                citySectors.some(
                  s =>
                    String(s.id) ===
                    String(a.sector_id)
                )
              );


            const cityMembers =
              new Set(
                cityAssignments.map(
                  a =>
                    String(a.member_id)
                )
              ).size;


            const cityCalendars =
              cityAssignments.reduce(
                (total,a) =>
                  total +
                  Number(a.calendar_count || 0),
                0
              );


            return `

              <div
                class="card"
                style="
                  margin-bottom:14px;
                  border:1px solid rgba(255,255,255,.10);
                  border-radius:16px;
                  padding:18px;
                "
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:flex-start;
                    gap:15px;
                    flex-wrap:wrap;
                  "
                >

                  <div>

                    <div
                      style="
                        font-size:19px;
                        font-weight:700;
                      "
                    >

                      🏘️
                      ${esc(city.name)}

                    </div>

                    <div
                      style="
                        margin-top:6px;
                        opacity:.75;
                        font-size:13px;
                      "
                    >

                      📍 ${citySectors.length}
                      secteur${citySectors.length > 1 ? 's' : ''}

                      &nbsp;·&nbsp;

                      👥 ${cityMembers}
                      membre${cityMembers > 1 ? 's' : ''}

                      &nbsp;·&nbsp;

                      📅 ${cityCalendars}
                      calendrier${cityCalendars > 1 ? 's' : ''}

                    </div>

                  </div>


                  <div
                    style="
                      display:flex;
                      gap:7px;
                      flex-wrap:wrap;
                    "
                  >

                    <button
                      type="button"
                      class="ghost"
                      onclick="calendarCityEdit('${city.id}')"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      class="ghost"
                      onclick="calendarCityDelete('${city.id}')"
                    >
                      🗑️
                    </button>

                    <button
                      type="button"
                      class="primary"
                      onclick="calendarCityOpen('${city.id}')"
                    >
                      Gérer →
                    </button>

                  </div>

                </div>

              </div>

            `;

          }).join('')

        : `

          <div
            class="card"
            style="
              padding:25px;
              text-align:center;
              opacity:.8;
            "
          >

            <div style="font-size:35px;">
              🏘️
            </div>

            <strong>
              Aucune commune créée
            </strong>

            <p>
              Commence par ajouter une commune.
            </p>

          </div>

        `;


    // ========================================================
    // POPUP PRINCIPALE
    // ========================================================

    openModal(`

      <div
        style="
          max-width:1000px;
          margin:auto;
        "
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:15px;
            flex-wrap:wrap;
          "
        >

          <div>

            <h2 style="margin-bottom:4px;">
              🧭 Tournées de calendrier
            </h2>

            <p
              style="
                margin-top:0;
                opacity:.7;
              "
            >
              Gestion des communes, secteurs et affectations
            </p>

          </div>


          <button
            type="button"
            class="primary"
            onclick="calendarCityCreate()"
          >
            ＋ Ajouter une commune
          </button>

        </div>


        <hr>


        <!-- ==================================================
             STATISTIQUES
        =================================================== -->

        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(170px,1fr));
            gap:12px;
            margin-bottom:20px;
          "
        >

          <div class="card" style="padding:16px;">

            <div style="font-size:25px;">
              🏘️
            </div>

            <div
              style="
                font-size:25px;
                font-weight:700;
              "
            >
              ${cities.length}
            </div>

            <small>
              Commune${cities.length > 1 ? 's' : ''}
            </small>

          </div>


          <div class="card" style="padding:16px;">

            <div style="font-size:25px;">
              📍
            </div>

            <div
              style="
                font-size:25px;
                font-weight:700;
              "
            >
              ${totalSectors}
            </div>

            <small>
              Secteur${totalSectors > 1 ? 's' : ''}
            </small>

          </div>


          <div class="card" style="padding:16px;">

            <div style="font-size:25px;">
              👥
            </div>

            <div
              style="
                font-size:25px;
                font-weight:700;
              "
            >
              ${totalMembersAssigned}
            </div>

            <small>
              Membres affectés
            </small>

          </div>


          <div class="card" style="padding:16px;">

            <div style="font-size:25px;">
              📦
            </div>

            <div
              style="
                font-size:25px;
                font-weight:700;
              "
            >
              ${totalCalendars}
            </div>

            <small>
              Calendriers
            </small>

          </div>

        </div>


        <!-- ==================================================
             COMMUNES
        =================================================== -->

        <h3>
          🏘️ Communes
        </h3>

        ${cityCards}


        <!-- ==================================================
             ACTIONS
        =================================================== -->

        <div
          class="row"
          style="
            margin-top:20px;
            justify-content:flex-end;
          "
        >

          <button
            type="button"
            class="ghost"
            onclick="printCalendarTours()"
          >
            🖨️ Imprimer le récapitulatif
          </button>


          <button
            type="button"
            class="primary"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR GESTION TOURNÉES :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger la gestion des tournées.'
    );

  }

}


// ============================================================
// ➕ CRÉER UNE COMMUNE
// ============================================================

async function calendarCityCreate(){

  openModal(`

    <h2>
      🏘️ Nouvelle commune
    </h2>

    <div class="field">

      <label>
        Nom de la commune
      </label>

      <input
        id="calendarCityName"
        class="input"
        placeholder="Ex : Bailleul"
      >

    </div>


    <div
      class="row"
      style="margin-top:15px;"
    >

      <button
        type="button"
        class="primary"
        onclick="calendarCitySaveCreate()"
      >
        💾 Créer
      </button>

      <button
        type="button"
        class="ghost"
        onclick="manageCalendarTours()"
      >
        Annuler
      </button>

    </div>

  `);

}


// ============================================================
// ENREGISTRER NOUVELLE COMMUNE
// ============================================================

async function calendarCitySaveCreate(){

  try{

    const name =
      $('calendarCityName')?.value.trim() || '';


    if(!name){

      alert(
        'Veuillez saisir le nom de la commune.'
      );

      return;

    }


    const {error} =
      await db
        .from('calendar_cities')
        .insert({
          name
        });


    if(error) throw error;


    alert(
      '✅ Commune créée.'
    );


    await manageCalendarTours();

  }catch(error){

    console.error(
      'ERREUR CRÉATION COMMUNE :',
      error
    );

    alert(
      error.message ||
      'Impossible de créer la commune.'
    );

  }

}


// ============================================================
// ✏️ MODIFIER UNE COMMUNE
// ============================================================

async function calendarCityEdit(id){

  try{

    const {data,error} =
      await db
        .from('calendar_cities')
        .select('*')
        .eq('id',id)
        .single();


    if(error) throw error;


    openModal(`

      <h2>
        ✏️ Modifier la commune
      </h2>

      <div class="field">

        <label>
          Nom de la commune
        </label>

        <input
          id="calendarCityName"
          class="input"
          value="${esc(data.name || '')}"
        >

      </div>


      <div
        class="row"
        style="margin-top:15px;"
      >

        <button
          type="button"
          class="primary"
          onclick="calendarCitySaveEdit('${id}')"
        >
          💾 Enregistrer
        </button>

        <button
          type="button"
          class="ghost"
          onclick="manageCalendarTours()"
        >
          Annuler
        </button>

      </div>

    `);

  }catch(error){

    alert(
      error.message ||
      'Impossible de charger la commune.'
    );

  }

}


// ============================================================
// ENREGISTRER MODIFICATION COMMUNE
// ============================================================

async function calendarCitySaveEdit(id){

  try{

    const name =
      $('calendarCityName')?.value.trim() || '';


    if(!name){

      alert(
        'Le nom de la commune est obligatoire.'
      );

      return;

    }


    const {error} =
      await db
        .from('calendar_cities')
        .update({
          name
        })
        .eq('id',id);


    if(error) throw error;


    alert(
      '✅ Commune modifiée.'
    );


    await manageCalendarTours();

  }catch(error){

    alert(
      error.message ||
      'Impossible de modifier la commune.'
    );

  }

}


// ============================================================
// 🗑️ SUPPRIMER UNE COMMUNE
// ============================================================

async function calendarCityDelete(id){

  if(
    !confirm(
      'Supprimer cette commune ?\n\n' +
      'Les secteurs et affectations liés seront également supprimés.'
    )
  ){

    return;

  }


  try{

    const {error} =
      await db
        .from('calendar_cities')
        .delete()
        .eq('id',id);


    if(error) throw error;


    alert(
      '🗑️ Commune supprimée.'
    );


    await manageCalendarTours();

  }catch(error){

    alert(
      error.message ||
      'Impossible de supprimer la commune.'
    );

  }

}


// ============================================================
// 📍 OUVRIR UNE COMMUNE
// ============================================================

async function calendarCityOpen(cityId){

  try{

    const [
      cityRes,
      sectorsRes,
      assignmentsRes,
      membersRes
    ] = await Promise.all([

      db
        .from('calendar_cities')
        .select('*')
        .eq('id',cityId)
        .single(),

      db
        .from('calendar_sectors')
        .select('*')
        .eq('city_id',cityId)
        .order('name',{ascending:true}),

      db
        .from('calendar_assignments')
        .select('*'),

      db
        .from('members')
        .select('id,first_name,last_name,active,role')
        .eq('active',true)
        .order('last_name',{ascending:true})

    ]);


    if(cityRes.error) throw cityRes.error;
    if(sectorsRes.error) throw sectorsRes.error;
    if(assignmentsRes.error) throw assignmentsRes.error;
    if(membersRes.error) throw membersRes.error;


    const city =
      cityRes.data;

    const sectors =
      sectorsRes.data || [];

    const assignments =
      assignmentsRes.data || [];

    const members =
      membersRes.data || [];


    const memberMap = {};

    members.forEach(m => {

      memberMap[String(m.id)] = m;

    });


    const sectorCards =
      sectors.length

        ? sectors.map(sector => {

            const sectorAssignments =
              assignments.filter(
                a =>
                  String(a.sector_id) ===
                  String(sector.id)
              );


            const referent =
              sector.referent_member_id
                ? memberMap[
                    String(
                      sector.referent_member_id
                    )
                  ]
                : null;


            const totalCalendars =
              sectorAssignments.reduce(
                (total,a) =>
                  total +
                  Number(a.calendar_count || 0),
                0
              );


            const membersHtml =
              sectorAssignments.length

                ? sectorAssignments.map(a => {

                    const m =
                      memberMap[
                        String(a.member_id)
                      ];


                    if(!m) return '';


                    return `

                      <div
                        style="
                          display:flex;
                          justify-content:space-between;
                          gap:10px;
                          align-items:center;
                          padding:8px 0;
                          border-bottom:
                            1px solid rgba(255,255,255,.07);
                        "
                      >

                        <span>

                          👤
                          ${esc(
                            `${m.first_name || ''} ${m.last_name || ''}`.trim()
                          )}

                        </span>

                        <strong>
                          📅
                          ${Number(a.calendar_count || 0)}
                        </strong>

                      </div>

                    `;

                  }).join('')

                : `

                    <p
                      style="
                        opacity:.65;
                        font-size:13px;
                      "
                    >
                      Aucun membre affecté.
                    </p>

                  `;


            return `

              <div
                class="card"
                style="
                  margin-bottom:14px;
                  padding:18px;
                "
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    gap:12px;
                    align-items:flex-start;
                    flex-wrap:wrap;
                  "
                >

                  <div>

                    <h3 style="margin-bottom:5px;">

                      📍
                      ${esc(sector.name)}

                    </h3>

                    <div
                      style="
                        font-size:13px;
                        opacity:.75;
                      "
                    >

                      👨‍🚒 Référent :

                      ${
                        referent

                          ? esc(
                              `${referent.first_name || ''} ${referent.last_name || ''}`.trim()
                            )

                          : '<em>Aucun référent</em>'
                      }

                    </div>

                  </div>


                  <div
                    style="
                      display:flex;
                      gap:7px;
                      flex-wrap:wrap;
                    "
                  >

                    <button
                      type="button"
                      class="ghost"
                      onclick="calendarSectorEdit('${sector.id}')"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      class="ghost"
                      onclick="calendarSectorDelete('${sector.id}')"
                    >
                      🗑️
                    </button>

                    <button
                      type="button"
                      class="primary"
                      onclick="calendarSectorManage('${sector.id}')"
                    >
                      Gérer →
                    </button>

                  </div>

                </div>


                <div style="margin-top:15px;">

                  ${membersHtml}

                </div>


                <div
                  style="
                    margin-top:12px;
                    font-size:13px;
                    opacity:.75;
                  "
                >

                  👥 ${sectorAssignments.length}
                  membre${sectorAssignments.length > 1 ? 's' : ''}

                  &nbsp;·&nbsp;

                  📅 ${totalCalendars}
                  calendrier${totalCalendars > 1 ? 's' : ''}

                </div>

              </div>

            `;

          }).join('')

        : `

          <div
            class="card"
            style="
              text-align:center;
              padding:25px;
            "
          >

            <div style="font-size:35px;">
              📍
            </div>

            <strong>
              Aucun secteur
            </strong>

            <p>
              Ajoute le premier secteur de cette commune.
            </p>

          </div>

        `;


    openModal(`

      <h2>
        🏘️ ${esc(city.name)}
      </h2>

      <p style="opacity:.7;">
        Gestion des secteurs et des tournées
      </p>


      <div
        class="row"
        style="
          justify-content:space-between;
          margin-bottom:15px;
        "
      >

        <button
          type="button"
          class="ghost"
          onclick="manageCalendarTours()"
        >
          ← Communes
        </button>

        <button
          type="button"
          class="primary"
          onclick="calendarSectorCreate('${city.id}')"
        >
          ＋ Ajouter un secteur
        </button>

      </div>


      <hr>


      ${sectorCards}


      <div
        class="row"
        style="
          justify-content:flex-end;
          margin-top:15px;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR OUVERTURE COMMUNE :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger la commune.'
    );

  }

}


// ============================================================
// ➕ CRÉER UN SECTEUR
// ============================================================

async function calendarSectorCreate(cityId){

  try{

    const {data:membersList,error} =
      await db
        .from('members')
        .select('id,first_name,last_name,active')
        .eq('active',true)
        .order('last_name',{ascending:true});


    if(error) throw error;


    const referentOptions =
      (membersList || []).map(m => `

        <option value="${m.id}">

          ${esc(
            `${m.first_name || ''} ${m.last_name || ''}`.trim()
          )}

        </option>

      `).join('');


    openModal(`

      <h2>
        📍 Nouveau secteur
      </h2>


      <div class="field">

        <label>
          Nom du secteur
        </label>

        <input
          id="calendarSectorName"
          class="input"
          placeholder="Ex : Centre"
        >

      </div>


      <div class="field">

        <label>
          👨‍🚒 Référent du secteur
        </label>

        <select
          id="calendarSectorReferent"
          class="select"
        >

          <option value="">
            Aucun référent
          </option>

          ${referentOptions}

        </select>

      </div>


      <div
        class="row"
        style="margin-top:15px;"
      >

        <button
          type="button"
          class="primary"
          onclick="calendarSectorSaveCreate('${cityId}')"
        >
          💾 Créer le secteur
        </button>

        <button
          type="button"
          class="ghost"
          onclick="calendarCityOpen('${cityId}')"
        >
          Annuler
        </button>

      </div>

    `);

  }catch(error){

    alert(
      error.message ||
      'Impossible de charger les membres.'
    );

  }

}


// ============================================================
// ENREGISTRER SECTEUR
// ============================================================

async function calendarSectorSaveCreate(cityId){

  try{

    const name =
      $('calendarSectorName')?.value.trim() || '';

    const referent_member_id =
      $('calendarSectorReferent')?.value || null;


    if(!name){

      alert(
        'Veuillez saisir le nom du secteur.'
      );

      return;

    }


    const {error} =
      await db
        .from('calendar_sectors')
        .insert({

          city_id:cityId,

          name,

          referent_member_id

        });


    if(error) throw error;


    alert(
      '✅ Secteur créé.'
    );


    await calendarCityOpen(cityId);

  }catch(error){

    alert(
      error.message ||
      'Impossible de créer le secteur.'
    );

  }

}


// ============================================================
// ✏️ MODIFIER SECTEUR
// ============================================================

async function calendarSectorEdit(id){

  try{

    const [
      sectorRes,
      membersRes
    ] = await Promise.all([

      db
        .from('calendar_sectors')
        .select('*')
        .eq('id',id)
        .single(),

      db
        .from('members')
        .select('id,first_name,last_name,active')
        .eq('active',true)
        .order('last_name',{ascending:true})

    ]);


    if(sectorRes.error) throw sectorRes.error;
    if(membersRes.error) throw membersRes.error;


    const sector =
      sectorRes.data;

    const membersList =
      membersRes.data || [];


    const options =
      membersList.map(m => `

        <option
          value="${m.id}"
          ${
            String(m.id) ===
            String(sector.referent_member_id)
              ? 'selected'
              : ''
          }
        >

          ${esc(
            `${m.first_name || ''} ${m.last_name || ''}`.trim()
          )}

        </option>

      `).join('');


    openModal(`

      <h2>
        ✏️ Modifier le secteur
      </h2>


      <div class="field">

        <label>
          Nom du secteur
        </label>

        <input
          id="calendarSectorName"
          class="input"
          value="${esc(sector.name || '')}"
        >

      </div>


      <div class="field">

        <label>
          👨‍🚒 Référent
        </label>

        <select
          id="calendarSectorReferent"
          class="select"
        >

          <option value="">
            Aucun référent
          </option>

          ${options}

        </select>

      </div>


      <div
        class="row"
        style="margin-top:15px;"
      >

        <button
          type="button"
          class="primary"
          onclick="calendarSectorSaveEdit('${id}')"
        >
          💾 Enregistrer
        </button>

        <button
          type="button"
          class="ghost"
          onclick="calendarCityOpen('${sector.city_id}')"
        >
          Annuler
        </button>

      </div>

    `);

  }catch(error){

    alert(
      error.message ||
      'Impossible de charger le secteur.'
    );

  }

}


// ============================================================
// ENREGISTRER MODIFICATION SECTEUR
// ============================================================

async function calendarSectorSaveEdit(id){

  try{

    const name =
      $('calendarSectorName')?.value.trim() || '';

    const referent_member_id =
      $('calendarSectorReferent')?.value || null;


    if(!name){

      alert(
        'Le nom du secteur est obligatoire.'
      );

      return;

    }


    const {data:sector,error:sectorError} =
      await db
        .from('calendar_sectors')
        .select('city_id')
        .eq('id',id)
        .single();


    if(sectorError) throw sectorError;


    const {error} =
      await db
        .from('calendar_sectors')
        .update({

          name,

          referent_member_id

        })
        .eq('id',id);


    if(error) throw error;


    alert(
      '✅ Secteur modifié.'
    );


    await calendarCityOpen(
      sector.city_id
    );

  }catch(error){

    alert(
      error.message ||
      'Impossible de modifier le secteur.'
    );

  }

}


// ============================================================
// 🗑️ SUPPRIMER SECTEUR
// ============================================================

async function calendarSectorDelete(id){

  if(
    !confirm(
      'Supprimer ce secteur ?\n\n' +
      'Les affectations des membres de ce secteur seront également supprimées.'
    )
  ){

    return;

  }


  try{

    const {data:sector,error:sectorError} =
      await db
        .from('calendar_sectors')
        .select('city_id')
        .eq('id',id)
        .single();


    if(sectorError) throw sectorError;


    const {error} =
      await db
        .from('calendar_sectors')
        .delete()
        .eq('id',id);


    if(error) throw error;


    alert(
      '🗑️ Secteur supprimé.'
    );


    await calendarCityOpen(
      sector.city_id
    );

  }catch(error){

    alert(
      error.message ||
      'Impossible de supprimer le secteur.'
    );

  }

}


// ============================================================
// 👥 GÉRER LES MEMBRES D'UN SECTEUR
// ============================================================

async function calendarSectorManage(id){

  try{

    const [
      sectorRes,
      membersRes,
      assignmentsRes
    ] = await Promise.all([

      db
        .from('calendar_sectors')
        .select('*')
        .eq('id',id)
        .single(),

      db
        .from('members')
        .select('id,first_name,last_name,active')
        .eq('active',true)
        .order('last_name',{ascending:true}),

      db
        .from('calendar_assignments')
        .select('*')
        .eq('sector_id',id)

    ]);


    if(sectorRes.error) throw sectorRes.error;
    if(membersRes.error) throw membersRes.error;
    if(assignmentsRes.error) throw assignmentsRes.error;


    const sector =
      sectorRes.data;

    const membersList =
      membersRes.data || [];

    const assignments =
      assignmentsRes.data || [];


    const assignmentMap = {};

    assignments.forEach(a => {

      assignmentMap[
        String(a.member_id)
      ] = a;

    });


    const memberRows =
      membersList.map(m => {

        const a =
          assignmentMap[
            String(m.id)
          ];


        const checked =
          !!a;

        const count =
          a
            ? Number(a.calendar_count || 0)
            : 0;


        return `

          <div
            class="card"
            style="
              padding:13px;
              margin-bottom:8px;
            "
          >

            <div
              style="
                display:grid;
                grid-template-columns:
                  auto 1fr 120px auto;
                gap:10px;
                align-items:center;
              "
            >

              <input
                type="checkbox"
                id="calendarMember_${m.id}"
                ${
                  checked
                    ? 'checked'
                    : ''
                }
              >


              <label
                for="calendarMember_${m.id}"
                style="cursor:pointer;"
              >

                👤
                ${esc(
                  `${m.first_name || ''} ${m.last_name || ''}`.trim()
                )}

              </label>


              <input
                type="number"
                min="0"
                step="1"
                class="input"
                id="calendarCount_${m.id}"
                value="${count}"
                placeholder="Calendriers"
              >


              ${
                checked

                  ? `

                    <button
                      type="button"
                      class="ghost"
                      onclick="calendarAssignmentDelete('${a.id}','${sector.id}')"
                    >
                      🗑️
                    </button>

                  `

                  : ''

              }

            </div>

          </div>

        `;

      }).join('');


    openModal(`

      <h2>
        👥 ${esc(sector.name)}
      </h2>

      <p style="opacity:.7;">
        Coche les membres affectés et indique leur nombre de calendriers.
      </p>


      <div
        style="
          max-height:55vh;
          overflow:auto;
          padding-right:4px;
        "
      >

        ${memberRows}

      </div>


      <div
        class="row"
        style="
          margin-top:15px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="calendarAssignmentsSave('${sector.id}')"
        >
          💾 Enregistrer les affectations
        </button>


        <button
          type="button"
          class="ghost"
          onclick="calendarCityOpen('${sector.city_id}')"
        >
          Retour
        </button>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR GESTION MEMBRES SECTEUR :',
      error
    );

    alert(
      error.message ||
      'Impossible de charger les membres.'
    );

  }

}


// ============================================================
// 💾 ENREGISTRER LES AFFECTATIONS
// ============================================================

async function calendarAssignmentsSave(sectorId){

  try{

    const [
      membersRes,
      assignmentsRes
    ] = await Promise.all([

      db
        .from('members')
        .select('id,active')
        .eq('active',true),

      db
        .from('calendar_assignments')
        .select('*')
        .eq('sector_id',sectorId)

    ]);


    if(membersRes.error) throw membersRes.error;
    if(assignmentsRes.error) throw assignmentsRes.error;


    const membersList =
      membersRes.data || [];

    const assignments =
      assignmentsRes.data || [];


    for(const m of membersList){

      const checkbox =
        document.getElementById(
          `calendarMember_${m.id}`
        );


      const countInput =
        document.getElementById(
          `calendarCount_${m.id}`
        );


      if(!checkbox || !countInput){

        continue;

      }


      const checked =
        checkbox.checked;

      const count =
        Math.max(
          0,
          parseInt(
            countInput.value,
            10
          ) || 0
        );


      const existing =
        assignments.find(
          a =>
            String(a.member_id) ===
            String(m.id)
        );


      if(checked){

        if(existing){

          const {error} =
            await db
              .from('calendar_assignments')
              .update({

                calendar_count:count,

                updated_at:
                  new Date().toISOString()

              })
              .eq('id',existing.id);


          if(error) throw error;

        }else{

          const {error} =
            await db
              .from('calendar_assignments')
              .insert({

                sector_id:sectorId,

                member_id:m.id,

                calendar_count:count

              });


          if(error) throw error;

        }

      }else if(existing){

        const {error} =
          await db
            .from('calendar_assignments')
            .delete()
            .eq('id',existing.id);


        if(error) throw error;

      }

    }


    alert(
      '✅ Affectations enregistrées.'
    );


    await calendarSectorManage(
      sectorId
    );

  }catch(error){

    console.error(
      'ERREUR ENREGISTREMENT AFFECTATIONS :',
      error
    );

    alert(
      error.message ||
      'Impossible d’enregistrer les affectations.'
    );

  }

}


// ============================================================
// 🗑️ SUPPRIMER UNE AFFECTATION
// ============================================================

async function calendarAssignmentDelete(
  assignmentId,
  sectorId
){

  if(
    !confirm(
      'Retirer ce membre du secteur ?'
    )
  ){

    return;

  }


  try{

    const {error} =
      await db
        .from('calendar_assignments')
        .delete()
        .eq('id',assignmentId);


    if(error) throw error;


    await calendarSectorManage(
      sectorId
    );

  }catch(error){

    alert(
      error.message ||
      'Impossible de retirer le membre.'
    );

  }

}


// ============================================================
// 🖨️ RÉCAPITULATIF / IMPRESSION
// ============================================================

async function printCalendarTours(){

  try{

    const [
      citiesRes,
      sectorsRes,
      assignmentsRes,
      membersRes
    ] = await Promise.all([

      db
        .from('calendar_cities')
        .select('*')
        .order('name',{ascending:true}),

      db
        .from('calendar_sectors')
        .select('*')
        .order('name',{ascending:true}),

      db
        .from('calendar_assignments')
        .select('*'),

      db
        .from('members')
        .select('id,first_name,last_name')
        .order('last_name',{ascending:true})

    ]);


    if(citiesRes.error) throw citiesRes.error;
    if(sectorsRes.error) throw sectorsRes.error;
    if(assignmentsRes.error) throw assignmentsRes.error;
    if(membersRes.error) throw membersRes.error;


    const cities =
      citiesRes.data || [];

    const sectors =
      sectorsRes.data || [];

    const assignments =
      assignmentsRes.data || [];

    const members =
      membersRes.data || [];


    const memberMap = {};

    members.forEach(m => {

      memberMap[
        String(m.id)
      ] = m;

    });


    let html = '';


    cities.forEach(city => {

      const citySectors =
        sectors.filter(
          s =>
            String(s.city_id) ===
            String(city.id)
        );


      let cityTotal = 0;


      let sectorHtml = '';


      citySectors.forEach(sector => {

        const referent =
          sector.referent_member_id
            ? memberMap[
                String(
                  sector.referent_member_id
                )
              ]
            : null;


        const sectorAssignments =
          assignments.filter(
            a =>
              String(a.sector_id) ===
              String(sector.id)
          );


        const sectorTotal =
          sectorAssignments.reduce(
            (total,a) =>
              total +
              Number(a.calendar_count || 0),
            0
          );


        cityTotal +=
          sectorTotal;


        sectorHtml += `

          <div class="print-sector">

            <h3>
              📍 ${esc(sector.name)}
            </h3>

            <p>
              <strong>Référent :</strong>
              ${
                referent
                  ? esc(
                      `${referent.first_name || ''} ${referent.last_name || ''}`.trim()
                    )
                  : 'Aucun'
              }
            </p>

            <table>

              <thead>

                <tr>

                  <th>Membre</th>

                  <th>Calendriers</th>

                </tr>

              </thead>

              <tbody>

                ${
                  sectorAssignments.length

                    ? sectorAssignments.map(a => {

                        const m =
                          memberMap[
                            String(a.member_id)
                          ];


                        return `

                          <tr>

                            <td>
                              ${
                                m
                                  ? esc(
                                      `${m.first_name || ''} ${m.last_name || ''}`.trim()
                                    )
                                  : 'Membre inconnu'
                              }
                            </td>

                            <td>
                              ${Number(a.calendar_count || 0)}
                            </td>

                          </tr>

                        `;

                      }).join('')

                    : `

                      <tr>

                        <td colspan="2">
                          Aucun membre affecté.
                        </td>

                      </tr>

                    `
                }

              </tbody>

              <tfoot>

                <tr>

                  <th>
                    Total secteur
                  </th>

                  <th>
                    ${sectorTotal}
                  </th>

                </tr>

              </tfoot>

            </table>

          </div>

        `;

      });


      html += `

        <section class="print-city">

          <h2>
            🏘️ ${esc(city.name)}
          </h2>

          ${sectorHtml}

          <div class="print-city-total">

            TOTAL ${esc(city.name)} :
            ${cityTotal} calendriers

          </div>

        </section>

      `;

    });


    const printWindow =
      window.open(
        '',
        '_blank'
      );


    if(!printWindow){

      alert(
        'Le navigateur a bloqué la fenêtre d’impression.'
      );

      return;

    }


    printWindow.document.write(`

      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>
          Récapitulatif des tournées de calendrier
        </title>

        <style>

          body{
            font-family:Arial,sans-serif;
            color:#222;
            padding:30px;
          }

          h1{
            margin-bottom:5px;
          }

          h2{
            margin-top:30px;
            border-bottom:2px solid #222;
            padding-bottom:8px;
          }

          h3{
            margin-bottom:5px;
          }

          .subtitle{
            color:#666;
            margin-bottom:25px;
          }

          .print-sector{
            margin:20px 0;
            page-break-inside:avoid;
          }

          table{
            width:100%;
            border-collapse:collapse;
            margin-top:10px;
          }

          th,
          td{
            border:1px solid #ccc;
            padding:8px;
            text-align:left;
          }

          th{
            background:#f2f2f2;
          }

          .print-city-total{
            font-size:17px;
            font-weight:bold;
            margin-top:15px;
            padding:12px;
            border:2px solid #222;
          }

          @media print{

            body{
              padding:10px;
            }

            .print-city{
              page-break-after:auto;
            }

          }

        </style>

      </head>

      <body>

        <h1>
          🧭 Récapitulatif des tournées de calendrier
        </h1>

        <div class="subtitle">

          Amicale des Sapeurs-Pompiers

          —
          ${new Date().toLocaleDateString('fr-FR')}

        </div>

        ${html}

     


</body>


      </html>

    `);


    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {

      printWindow.print();

    },300);

  }catch(error){

    console.error(
      'ERREUR IMPRESSION TOURNÉES :',
      error
    );

    alert(
      error.message ||
      'Impossible de préparer l’impression.'
    );

  }

}

// ============================================================
// 🧭 CONSULTATION — TOURNÉE DE CALENDRIER DU MEMBRE
// ============================================================

async function showMyCalendarTour(){

  try{

    if(!member || !member.id){

      alert('Impossible de retrouver votre compte.');

      return;

    }


    // ========================================================
    // RÉCUPÉRATION DE L'AFFECTATION DU MEMBRE
    // ========================================================

    const {data:assignment,error:assignmentError} =
      await db
        .from('calendar_assignments')
        .select('*')
        .eq('member_id',member.id)
        .maybeSingle();


    if(assignmentError) throw assignmentError;


    // ========================================================
    // AUCUNE AFFECTATION
    // ========================================================

    if(!assignment){

      openModal(`

        <div
          style="
            max-width:600px;
            margin:auto;
            text-align:center;
          "
        >

          <div
            style="
              font-size:55px;
              margin-bottom:10px;
            "
          >
            🧭
          </div>

          <h2>
            Ma tournée de calendrier
          </h2>

          <div
            class="card"
            style="
              padding:22px;
              margin-top:20px;
            "
          >

            <div style="font-size:30px;">
              ℹ️
            </div>

            <strong>
              Aucune tournée de calendrier
            </strong>

            <p
              style="
                opacity:.7;
                margin-bottom:0;
              "
            >
              Aucune tournée ne vous est
              actuellement attribuée.
            </p>

          </div>


          <div
            class="row"
            style="
              justify-content:center;
              margin-top:20px;
            "
          >

            <button
              type="button"
              class="primary"
              onclick="closeModal()"
            >
              Fermer
            </button>

          </div>

        </div>

      `);

      return;

    }


    // ========================================================
    // RÉCUPÉRATION DU SECTEUR
    // ========================================================

    const {data:sector,error:sectorError} =
      await db
        .from('calendar_sectors')
        .select('*')
        .eq('id',assignment.sector_id)
        .maybeSingle();


    if(sectorError) throw sectorError;


    if(!sector){

      openModal(`

        <div
          style="
            text-align:center;
            padding:20px;
          "
        >

          <div style="font-size:45px;">
            ⚠️
          </div>

          <h2>
            Tournée introuvable
          </h2>

          <p>
            Votre affectation existe mais
            le secteur associé n'est plus disponible.
          </p>

          <button
            type="button"
            class="primary"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>

      `);

      return;

    }


    // ========================================================
    // RÉCUPÉRATION DE LA COMMUNE
    // ========================================================

    const {data:city,error:cityError} =
      await db
        .from('calendar_cities')
        .select('*')
        .eq('id',sector.city_id)
        .maybeSingle();


    if(cityError) throw cityError;


    // ========================================================
    // RÉCUPÉRATION DU RÉFÉRENT
    // ========================================================

    let referent = null;


    if(sector.referent_member_id){

      const {data:referentData,error:referentError} =
        await db
          .from('members')
          .select('id,first_name,last_name,phone')
          .eq('id',sector.referent_member_id)
          .maybeSingle();


      if(referentError) throw referentError;


      referent =
        referentData || null;

    }


    // ========================================================
    // AFFICHAGE
    // ========================================================

    openModal(`

      <div
        style="
          max-width:650px;
          margin:auto;
        "
      >

        <div
          style="
            text-align:center;
            margin-bottom:22px;
          "
        >

          <div
            style="
              font-size:50px;
              margin-bottom:5px;
            "
          >
            🧭
          </div>

          <h2 style="margin-bottom:5px;">
            Ma tournée de calendrier
          </h2>

          <p
            style="
              margin:0;
              opacity:.7;
            "
          >
            Vos informations d'affectation
          </p>

        </div>


        <!-- ==================================================
             COMMUNE
        =================================================== -->

        <div
          class="card"
          style="
            padding:18px;
            margin-bottom:12px;
          "
        >

          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              opacity:.65;
              margin-bottom:5px;
            "
          >
            🏘️ Commune
          </div>

          <div
            style="
              font-size:21px;
              font-weight:700;
            "
          >
            ${
              city
                ? esc(city.name)
                : 'Non renseignée'
            }
          </div>

        </div>


        <!-- ==================================================
             SECTEUR
        =================================================== -->

        <div
          class="card"
          style="
            padding:18px;
            margin-bottom:12px;
          "
        >

          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              opacity:.65;
              margin-bottom:5px;
            "
          >
            📍 Secteur
          </div>

          <div
            style="
              font-size:21px;
              font-weight:700;
            "
          >
            ${esc(sector.name)}
          </div>

        </div>


        <!-- ==================================================
             RÉFÉRENT
        =================================================== -->

        <div
          class="card"
          style="
            padding:18px;
            margin-bottom:12px;
          "
        >

          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              opacity:.65;
              margin-bottom:5px;
            "
          >
            👨‍🚒 Référent secteur
          </div>

          <div
            style="
              font-size:19px;
              font-weight:700;
            "
          >

            ${
              referent

                ? `

                  ${esc(
                    `${referent.first_name || ''} ${referent.last_name || ''}`.trim()
                  )}

                `

                : `

                  <span style="opacity:.6;">
                    Aucun référent renseigné
                  </span>

                `
            }

          </div>


          ${
            referent?.phone

              ? `

                <div
                  style="
                    margin-top:7px;
                    opacity:.75;
                  "
                >
                  📞 ${esc(referent.phone)}
                </div>

              `

              : ''

          }

        </div>


        <!-- ==================================================
             NOMBRE DE CALENDRIERS
        =================================================== -->

        <div
          class="card"
          style="
            padding:18px;
            margin-bottom:20px;
          "
        >

          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              opacity:.65;
              margin-bottom:5px;
            "
          >
            📅 Calendriers attribués
          </div>

          <div
            style="
              font-size:30px;
              font-weight:800;
            "
          >
            ${Number(assignment.calendar_count || 0)}
          </div>

        </div>


        <div
          style="
            text-align:center;
            opacity:.6;
            font-size:12px;
          "
        >
          Ces informations sont gérées par l'administrateur.
        </div>


        <div
          class="row"
          style="
            justify-content:center;
            margin-top:20px;
          "
        >

          <button
            type="button"
            class="primary"
            onclick="closeModal()"
          >
            Fermer
          </button>

        </div>

      </div>

    `);

  }catch(error){

    console.error(
      'ERREUR CONSULTATION TOURNÉE :',
      error
    );

    alert(
      error.message ||
      'Impossible de récupérer votre tournée de calendrier.'
    );

  }

}

/* =========================================================
   AFFICHAGE D'UNE CATÉGORIE DE LA COMPOSITION
========================================================= */

async function showAdminComposition(category){

  try{

    /* =========================
       RÉCUPÉRATION DES DONNÉES
    ========================= */

    const {
      data:members,
      error:membersError
    } = await db
      .from('members')
      .select('*');

    if(membersError){
      throw membersError;
    }


    const {
      data:children,
      error:childrenError
    } = await db
      .from('member_children')
      .select(`
        id,
        member_id,
        first_name,
        last_name,
        gender,
        birth_date
      `)
      .order('last_name',{ascending:true});

    if(childrenError){
      throw childrenError;
    }


    let title = '';
    let icon = '';
    let list = [];


    /* =========================
       MEMBRES
    ========================= */

    if(category === 'members'){

      title = 'Membres';
      icon = '👥';

      list = members
        .slice()
        .sort((a,b)=>
          `${a.last_name || ''} ${a.first_name || ''}`
            .localeCompare(
              `${b.last_name || ''} ${b.first_name || ''}`,
              'fr'
            )
        );

    }


    /* =========================
       ACTIFS
    ========================= */

    else if(category === 'active'){

      title = 'Membres actifs';
      icon = '🟢';

      list = members
        .filter(m =>
          String(m.status || '').toLowerCase() === 'actif'
        )
        .slice()
        .sort((a,b)=>
          `${a.last_name || ''} ${a.first_name || ''}`
            .localeCompare(
              `${b.last_name || ''} ${b.first_name || ''}`,
              'fr'
            )
        );

    }


    /* =========================
       RETRAITÉS
    ========================= */

    else if(category === 'retired'){

      title = 'Membres retraités';
      icon = '⚪';

      list = members
        .filter(m =>
          String(m.status || '').toLowerCase() === 'retraite'
        )
        .slice()
        .sort((a,b)=>
          `${a.last_name || ''} ${a.first_name || ''}`
            .localeCompare(
              `${b.last_name || ''} ${b.first_name || ''}`,
              'fr'
            )
        );

    }


    /* =========================
       BUREAU
    ========================= */

    else if(category === 'bureau'){

      title = 'Membres du bureau';
      icon = '👔';

      list = members
        .filter(m => m.bureau_member === true)
        .slice()
        .sort((a,b)=>
          `${a.last_name || ''} ${a.first_name || ''}`
            .localeCompare(
              `${b.last_name || ''} ${b.first_name || ''}`,
              'fr'
            )
        );

    }


    /* =========================
       ENFANTS
    ========================= */

    else if(category === 'children'){

      title = 'Enfants de moins de 16 ans';
      icon = '👨‍👩‍👧';

      const today = new Date();

      list = children
        .filter(child => {

          if(!child.birth_date){
            return false;
          }

          const birth =
            new Date(child.birth_date);

          if(Number.isNaN(birth.getTime())){
            return false;
          }

     const age =
  today.getFullYear() -
  birth.getFullYear();

return age >= 0 && age <= 16;   

        })
        .map(child => {

          const birth =
            new Date(child.birth_date);

          const today =
            new Date();

          let years =
            today.getFullYear() -
            birth.getFullYear();

          let months =
            today.getMonth() -
            birth.getMonth();

          if(today.getDate() < birth.getDate()){
            months--;
          }

          if(months < 0){
            years--;
            months += 12;
          }

          return {
            ...child,
            age_years: Math.max(0,years),
            age_months: Math.max(0,months)
          };

        })
        .sort((a,b)=>
          a.age_years - b.age_years ||
          a.age_months - b.age_months
        );

    }


    /* =========================
       AFFICHAGE
    ========================= */

    let html = `

      <h2>
        ${icon} ${esc(title)}
      </h2>

      <p class="muted">
        ${list.length}
        personne${list.length > 1 ? 's' : ''}
      </p>

      <div
        style="
          margin-top:18px;
          display:flex;
          flex-direction:column;
          gap:8px;
        "
      >
    `;


    if(!list.length){

      html += `

        <div class="card">

          <p style="margin:0;text-align:center;">
            📭 Aucune personne dans cette catégorie.
          </p>

        </div>

      `;

    }else{

      list.forEach(person => {

        const firstName =
          person.first_name || '';

        const lastName =
          person.last_name || '';

        const name =
          `${firstName} ${lastName}`.trim()
          || 'Nom inconnu';


        html += `

          <div
            class="card"
            style="
              margin:0;
              padding:12px 15px;
            "
          >

            <strong>
              👤 ${esc(name)}
            </strong>

        `;


        /* =========================
           ÂGE DES ENFANTS
        ========================= */

        if(category === 'children'){

          html += `

            <div
              class="muted"
              style="margin-top:4px;"
            >

              🎂
              ${person.age_years} an${person.age_years > 1 ? 's' : ''}
              ${person.age_months} mois

            </div>

          `;

        }


        html += `

          </div>

        `;

      });

    }


    html += `

      </div>

      <div
        class="row"
        style="
          margin-top:20px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >
          Fermer
        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR COMPOSITION AMICALE :',
      error
    );

    alert(
      error.message ||
      'Impossible d’afficher cette catégorie.'
    );

  }

}

/* =========================================================
   💾 SAUVEGARDE COMPLÈTE DU SYSTÈME
   ========================================================= */

async function backupSystemData(){

  try{

    if(!confirm(
      '💾 Voulez-vous créer une sauvegarde complète des données ?'
    )){
      return;
    }

    const tables = [
      'members',
      'children',
      'events',
      'event_responses',
      'ideas',
      'material_requests',
      'material_request_items',
      'conversations',
      'conversation_participants',
      'conversation_messages',
      'documents',
      'polls',
      'poll_responses'
    ];

    const backup = {
      app: 'Amicale des Sapeurs-Pompiers de Bailleul',
      type: 'full_backup',
      created_at: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for(const table of tables){

      const {
        data,
        error
      } = await db
        .from(table)
        .select('*');

      if(error){

        console.warn(
          `Table ${table} non sauvegardée :`,
          error.message
        );

        backup.data[table] = [];

        continue;
      }

      backup.data[table] = data || [];

    }


    /* =====================================================
       CRÉATION DU FICHIER JSON
       ===================================================== */

    const json = JSON.stringify(
      backup,
      null,
      2
    );

    const blob = new Blob(
      [json],
      {
        type:'application/json'
      }
    );


    const url =
      URL.createObjectURL(blob);


    const date =
      new Date();


    const pad =
      n => String(n).padStart(2,'0');


    const filename =
      `sauvegarde_amicale_${
        date.getFullYear()
      }-${
        pad(date.getMonth()+1)
      }-${
        pad(date.getDate())
      }_${
        pad(date.getHours())
      }-${
        pad(date.getMinutes())
      }.json`;


    const link =
      document.createElement('a');

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);


    /* =====================================================
       RÉSUMÉ
       ===================================================== */

    const totalRecords =
      Object.values(backup.data)
        .reduce(
          (total, rows) =>
            total + rows.length,
          0
        );


    alert(
      `✅ Sauvegarde terminée.\n\n` +
      `📦 ${tables.length} tables traitées\n` +
      `📊 ${totalRecords} enregistrements sauvegardés\n\n` +
      `📁 Fichier : ${filename}`
    );


/* =====================================================
   📜 HISTORIQUE — SAUVEGARDE
===================================================== */

if(typeof addSystemHistory === 'function'){

  await addSystemHistory(
    'backups',
    'Sauvegarde du système',
    `Sauvegarde complète effectuée : ${tables.length} tables traitées et ${totalRecords} enregistrements sauvegardés.`,
    'success',
    {
      tables_count: tables.length,
      records_count: totalRecords,
      filename: filename
    }
  );

}
    
  }catch(error){

    console.error(
      'ERREUR SAUVEGARDE :',
      error
    );

    alert(
      error.message ||
      '❌ Impossible de créer la sauvegarde.'
    );

  }

}

/* =========================================================
   📤 RESTAURATION D'UNE SAUVEGARDE
   ========================================================= */

async function restoreSystemData(){

  try{

    const input =
      document.createElement('input');

    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async function(){

      const file =
        input.files?.[0];

      if(!file){
        return;
      }

      try{

        /* =========================
           LECTURE DU FICHIER
        ========================= */

        const text =
          await file.text();

        let backup;

        try{

          backup =
            JSON.parse(text);

        }catch(error){

          alert(
            '❌ Le fichier sélectionné n’est pas un fichier JSON valide.'
          );

          return;
        }


        /* =========================
           VÉRIFICATION
        ========================= */

        if(
          !backup ||
          backup.type !== 'full_backup' ||
          !backup.data ||
          typeof backup.data !== 'object'
        ){

          alert(
            '❌ Ce fichier ne semble pas être une sauvegarde valide de l’application.'
          );

          return;
        }


        const tables =
          Object.keys(backup.data);


        const totalRecords =
          Object.values(backup.data)
            .reduce(
              (total, rows) =>
                total +
                (
                  Array.isArray(rows)
                    ? rows.length
                    : 0
                ),
              0
            );


        /* =========================
           PREMIÈRE CONFIRMATION
        ========================= */

        const firstConfirm =
          confirm(

            `📤 SAUVEGARDE DÉTECTÉE\n\n` +

            `📅 Créée le : ` +
            `${
              backup.created_at
                ? new Date(
                    backup.created_at
                  ).toLocaleString('fr-FR')
                : 'Date inconnue'
            }\n\n` +

            `📦 Tables présentes : ${tables.length}\n` +

            `📊 Enregistrements : ${totalRecords}\n\n` +

            `⚠️ La restauration va modifier les données existantes.\n\n` +

            `Continuer ?`

          );


        if(!firstConfirm){
          return;
        }


        /* =========================
           DEUXIÈME CONFIRMATION
        ========================= */

        const secondConfirm =
          prompt(
            '⚠️ DERNIÈRE CONFIRMATION\n\n' +
            'Pour confirmer la restauration, écrivez exactement : RESTAURER'
          );


        if(secondConfirm !== 'RESTAURER'){

          alert(
            '❌ Restauration annulée.'
          );

          return;

        }


        /* =========================
           RESTAURATION
        ========================= */

        let restored = 0;

        let errors = [];


        for(const table of tables){

          const rows =
            backup.data[table];


          if(
            !Array.isArray(rows) ||
            rows.length === 0
          ){

            continue;

          }


          try{

            const {
              error
            } = await db
              .from(table)
              .upsert(
                rows,
                {
                  onConflict:'id'
                }
              );


            if(error){

              errors.push(
                `${table} : ${error.message}`
              );

            }else{

              restored +=
                rows.length;

            }

          }catch(error){

            errors.push(
              `${table} : ${error.message}`
            );

          }

        }


        /* =========================
           RÉSULTAT
        ========================= */

        if(errors.length){

          alert(

            `⚠️ RESTAURATION PARTIELLE\n\n` +

            `✅ Enregistrements restaurés : ${restored}\n\n` +

            `❌ Tables avec erreur :\n` +

            errors.join('\n')

          );

        }else{

          alert(

            `✅ RESTAURATION TERMINÉE\n\n` +

            `📊 ${restored} enregistrements restaurés.\n\n` +

            `🔄 Rechargez l'application pour actualiser les données.`

          );

        }

/* =====================================================
   📜 HISTORIQUE — RESTAURATION
===================================================== */

if(typeof addSystemHistory === 'function'){

  await addSystemHistory(
    'restorations',
    errors.length
      ? 'Restauration partielle du système'
      : 'Restauration du système',
    errors.length
      ? `Restauration partielle : ${restored} enregistrements restaurés avec ${errors.length} erreur(s).`
      : `Restauration complète effectuée : ${restored} enregistrements restaurés.`,
    errors.length
      ? 'warning'
      : 'success',
    {
      restored_count: restored,
      tables_count: tables.length,
      errors_count: errors.length
    }
  );

}
        

      }catch(error){

        console.error(
          'ERREUR RESTAURATION :',
          error
        );

        alert(
          error.message ||
          '❌ Impossible de restaurer la sauvegarde.'
        );

      }

    };


    input.click();


  }catch(error){

    console.error(
      'ERREUR CHARGEMENT SAUVEGARDE :',
      error
    );

    alert(
      error.message ||
      '❌ Impossible de sélectionner la sauvegarde.'
    );

  }

}

/* =========================================================
   📤 RESTAURATION D'UNE SAUVEGARDE
   ========================================================= */

async function restoreSystemData(){

  try{

    const input =
      document.createElement('input');

    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async function(){

      const file =
        input.files?.[0];

      if(!file){
        return;
      }

      try{

        /* =========================
           LECTURE DU FICHIER
        ========================= */

        const text =
          await file.text();

        let backup;

        try{

          backup =
            JSON.parse(text);

        }catch(error){

          alert(
            '❌ Le fichier sélectionné n’est pas un fichier JSON valide.'
          );

          return;
        }


        /* =========================
           VÉRIFICATION
        ========================= */

        if(
          !backup ||
          backup.type !== 'full_backup' ||
          !backup.data ||
          typeof backup.data !== 'object'
        ){

          alert(
            '❌ Ce fichier ne semble pas être une sauvegarde valide de l’application.'
          );

          return;
        }


        const tables =
          Object.keys(backup.data);


        const totalRecords =
          Object.values(backup.data)
            .reduce(
              (total, rows) =>
                total +
                (
                  Array.isArray(rows)
                    ? rows.length
                    : 0
                ),
              0
            );


        /* =========================
           PREMIÈRE CONFIRMATION
        ========================= */

        const firstConfirm =
          confirm(

            `📤 SAUVEGARDE DÉTECTÉE\n\n` +

            `📅 Créée le : ` +
            `${
              backup.created_at
                ? new Date(
                    backup.created_at
                  ).toLocaleString('fr-FR')
                : 'Date inconnue'
            }\n\n` +

            `📦 Tables présentes : ${tables.length}\n` +

            `📊 Enregistrements : ${totalRecords}\n\n` +

            `⚠️ La restauration va modifier les données existantes.\n\n` +

            `Continuer ?`

          );


        if(!firstConfirm){
          return;
        }


        /* =========================
           DEUXIÈME CONFIRMATION
        ========================= */

        const secondConfirm =
          prompt(
            '⚠️ DERNIÈRE CONFIRMATION\n\n' +
            'Pour confirmer la restauration, écrivez exactement : RESTAURER'
          );


        if(secondConfirm !== 'RESTAURER'){

          alert(
            '❌ Restauration annulée.'
          );

          return;

        }


        /* =========================
           RESTAURATION
        ========================= */

        let restored = 0;

        let errors = [];


        for(const table of tables){

          const rows =
            backup.data[table];


          if(
            !Array.isArray(rows) ||
            rows.length === 0
          ){

            continue;

          }


          try{

            const {
              error
            } = await db
              .from(table)
              .upsert(
                rows,
                {
                  onConflict:'id'
                }
              );


            if(error){

              errors.push(
                `${table} : ${error.message}`
              );

            }else{

              restored +=
                rows.length;

            }

          }catch(error){

            errors.push(
              `${table} : ${error.message}`
            );

          }

        }


        /* =========================
           RÉSULTAT
        ========================= */

        if(errors.length){

          alert(

            `⚠️ RESTAURATION PARTIELLE\n\n` +

            `✅ Enregistrements restaurés : ${restored}\n\n` +

            `❌ Tables avec erreur :\n` +

            errors.join('\n')

          );

        }else{

          alert(

            `✅ RESTAURATION TERMINÉE\n\n` +

            `📊 ${restored} enregistrements restaurés.\n\n` +

            `🔄 Rechargez l'application pour actualiser les données.`

          );

        }


      }catch(error){

        console.error(
          'ERREUR RESTAURATION :',
          error
        );

        alert(
          error.message ||
          '❌ Impossible de restaurer la sauvegarde.'
        );

      }

    };


    input.click();


  }catch(error){

    console.error(
      'ERREUR CHARGEMENT SAUVEGARDE :',
      error
    );

    alert(
      error.message ||
      '❌ Impossible de sélectionner la sauvegarde.'
    );

  }

}

/* =========================================================
   🚧 ACTIVER / DÉSACTIVER LE MODE MAINTENANCE
   ========================================================= */

async function toggleMaintenanceMode(){

  try{

    const {data:settings,error:loadError}=await db
      .from('system_settings')
      .select('*')
      .eq('id','global')
      .single();

    if(loadError) throw loadError;


    const newState =
      !Boolean(settings?.maintenance_mode);


    const message =
      settings?.maintenance_message ||
      'L’application est actuellement en maintenance. Merci de revenir ultérieurement.';


    const action =
      newState
        ? 'ACTIVER'
        : 'DÉSACTIVER';


    if(!confirm(
      newState
        ? '🚧 Voulez-vous ACTIVER le mode maintenance ?\n\nLes utilisateurs ne pourront plus accéder à l’application.'
        : '🟢 Voulez-vous DÉSACTIVER le mode maintenance ?\n\nL’application redeviendra accessible aux utilisateurs.'
    )){
      return;
    }


    const {error:updateError}=await db
      .from('system_settings')
      .update({
        maintenance_mode:newState,
        maintenance_message:message,
        updated_at:new Date().toISOString()
      })
      .eq('id','global')
      .select();


    if(updateError){
      throw updateError;
    }


    /* =====================================================
       📜 HISTORIQUE DU SYSTÈME
    ===================================================== */

    if(typeof addSystemHistory === 'function'){

      await addSystemHistory(
        'maintenance',
        newState
          ? 'Activation du mode maintenance'
          : 'Désactivation du mode maintenance',
        newState
          ? 'Le mode maintenance a été activé par l’administrateur.'
          : 'Le mode maintenance a été désactivé par l’administrateur.',
        'success',
        {
          maintenance_mode:newState
        }
      );

    }


    alert(
      newState
        ? '🚧 Mode maintenance activé.'
        : '🟢 Mode maintenance désactivé.'
    );


    /*
      Actualise le tableau de bord administrateur
      pour afficher le nouvel état.
    */

    if(typeof renderAdmin === 'function'){
      await renderAdmin();
    }


  }catch(error){

    console.error(
      'ERREUR MODE MAINTENANCE :',
      error
    );

    alert(
      error.message ||
      '❌ Impossible de modifier le mode maintenance.'
    );

  }

}

async function openMaintenanceDiagnostic(){

  const checks = [];

  /*
  ============================================================
  🧪 DIAGNOSTIC COMPLET DU SYSTÈME
  ============================================================
  Aucun INSERT
  Aucun UPDATE
  Aucun DELETE
  Aucun changement de données
  ============================================================
  */


  /* ----------------------------------------------------------
     OUTILS
  ---------------------------------------------------------- */

  function addCheck(
    name,
    status,
    detail = ''
  ){

    checks.push({
      name,
      status,
      detail
    });

  }


  async function testTable(
    table,
    label,
    select = 'id'
  ){

    try{

      const result =
        await db
          .from(table)
          .select(select, {
            count:'exact',
            head:false
          })
          .limit(1);

      if(result.error){

        addCheck(
          label,
          'error',
          result.error.message
        );

        return;

      }

      addCheck(
        label,
        'ok',
        result.count !== null
          ? `${result.count} enregistrement(s)`
          : 'Accessible'
      );

    }catch(error){

      addCheck(
        label,
        'error',
        error.message || 'Erreur inconnue'
      );

    }

  }


  /* ----------------------------------------------------------
     1️⃣ JAVASCRIPT
  ---------------------------------------------------------- */

  try{

    if(typeof db !== 'undefined'){
      addCheck(
        'Connexion Supabase JavaScript',
        'ok',
        'Client Supabase disponible'
      );
    }else{
      addCheck(
        'Connexion Supabase JavaScript',
        'error',
        'Objet db introuvable'
      );
    }

  }catch(error){

    addCheck(
      'Connexion Supabase JavaScript',
      'error',
      error.message
    );

  }


  /* ----------------------------------------------------------
     2️⃣ SESSION
  ---------------------------------------------------------- */

  try{

    const {
      data,
      error
    } = await db.auth.getSession();

    if(error){

      addCheck(
        'Session utilisateur',
        'error',
        error.message
      );

    }else if(data?.session){

      addCheck(
        'Session utilisateur',
        'ok',
        'Session Supabase active'
      );

    }else{

      addCheck(
        'Session utilisateur',
        'warning',
        'Aucune session active'
      );

    }

  }catch(error){

    addCheck(
      'Session utilisateur',
      'error',
      error.message
    );

  }


  /* ----------------------------------------------------------
     3️⃣ ADMINISTRATEUR
  ---------------------------------------------------------- */

  try{

    if(member){

      if(
        String(member.role || '')
          .toLowerCase() === 'admin'
      ){

        addCheck(
          'Compte administrateur',
          'ok',
          `${member.first_name || ''} ${member.last_name || ''}`.trim()
        );

      }else{

        addCheck(
          'Compte administrateur',
          'warning',
          'Compte actuellement non administrateur'
        );

      }

    }else{

      addCheck(
        'Compte administrateur',
        'warning',
        'Variable member non disponible'
      );

    }

  }catch(error){

    addCheck(
      'Compte administrateur',
      'error',
      error.message
    );

  }


  /* ----------------------------------------------------------
     4️⃣ MODE MAINTENANCE
  ---------------------------------------------------------- */

  try{

    const result =
      await db
        .from('system_settings')
        .select(
          'maintenance_mode,maintenance_message,updated_at'
        )
        .eq('id','global')
        .single();

    if(result.error){

      addCheck(
        'Mode maintenance',
        'error',
        result.error.message
      );

    }else{

      addCheck(
        'Mode maintenance',
        'ok',
        result.data?.maintenance_mode === true
          ? '🚧 Activé'
          : '🟢 Désactivé'
      );

    }

  }catch(error){

    addCheck(
      'Mode maintenance',
      'error',
      error.message
    );

  }


  /* ----------------------------------------------------------
     5️⃣ TABLES PRINCIPALES
  ---------------------------------------------------------- */

  await testTable(
    'members',
    'Base des membres'
  );


  await testTable(
    'member_children',
    'Enfants des membres'
  );


  await testTable(
    'events',
    'Événements / festivités'
  );


  await testTable(
    'event_responses',
    'Réponses aux événements'
  );


  await testTable(
    'polls',
    'Sondages'
  );


  await testTable(
    'poll_responses',
    'Réponses aux sondages'
  );


  await testTable(
    'ideas',
    'Boîte à idées'
  );


  await testTable(
    'material_requests',
    'Demandes de matériel'
  );


  await testTable(
    'material_request_items',
    'Articles des demandes matériel'
  );


  await testTable(
    'materials',
    'Matériel'
  );


  await testTable(
    'listings',
    'Documents / annonces'
  );


  await testTable(
    'admin_notes',
    'Messages / notes administrateur'
  );


  await testTable(
    'admin_note_reads',
    'Lectures des messages administrateur'
  );


  /* ----------------------------------------------------------
     6️⃣ ÉLÉMENTS JAVASCRIPT ESSENTIELS
  ---------------------------------------------------------- */

  const functionsToCheck = [

    'login',
    'logout',
    'renderAdmin',
    'renderUser',
    'checkMaintenanceMode',
    'toggleMaintenanceMode',
    'openMaintenanceDiagnostic',
    'showAdminComposition',
    'saveMaterialRequest'

  ];


  functionsToCheck.forEach(
    functionName => {

      try{

        if(
          typeof window[functionName] ===
          'function'
        ){

          addCheck(
            `Fonction ${functionName}()`,
            'ok',
            'Fonction disponible'
          );

        }else{

          addCheck(
            `Fonction ${functionName}()`,
            'error',
            'Fonction introuvable'
          );

        }

      }catch(error){

        addCheck(
          `Fonction ${functionName}()`,
          'error',
          error.message
        );

      }

    }
  );


  /* ----------------------------------------------------------
     7️⃣ ÉLÉMENTS HTML IMPORTANTS
  ---------------------------------------------------------- */

  const elementsToCheck = [

    ['loginView','Écran de connexion'],
    ['mainView','Application principale'],
    ['homeAdmin','Espace administrateur'],
    ['homeUser','Espace utilisateur']

  ];


  elementsToCheck.forEach(
    ([id,label]) => {

      const element =
        document.getElementById(id);

      addCheck(
        label,
        element
          ? 'ok'
          : 'warning',
        element
          ? 'Élément présent'
          : `#${id} introuvable`
      );

    }
  );


  /* ----------------------------------------------------------
     8️⃣ STOCKAGE LOCAL
  ---------------------------------------------------------- */

  try{

    const testKey =
      '__system_diagnostic_test__';

    localStorage.setItem(
      testKey,
      'ok'
    );

    const testValue =
      localStorage.getItem(testKey);

    localStorage.removeItem(testKey);

    if(testValue === 'ok'){

      addCheck(
        'Stockage local',
        'ok',
        'localStorage fonctionnel'
      );

    }else{

      addCheck(
        'Stockage local',
        'warning',
        'Lecture/écriture inhabituelle'
      );

    }

  }catch(error){

    addCheck(
      'Stockage local',
      'warning',
      error.message
    );

  }


  /* ----------------------------------------------------------
     9️⃣ RÉSEAU
  ---------------------------------------------------------- */

  try{

    if(navigator.onLine){

      addCheck(
        'Connexion Internet',
        'ok',
        'Navigateur connecté'
      );

    }else{

      addCheck(
        'Connexion Internet',
        'warning',
        'Navigateur hors ligne'
      );

    }

  }catch(error){

    addCheck(
      'Connexion Internet',
      'warning',
      error.message
    );

  }


  /* ----------------------------------------------------------
     🔟 COMPTEURS
  ---------------------------------------------------------- */

  try{

    const counts = {

      membres:
        await db
          .from('members')
          .select('*',{
            count:'exact',
            head:true
          }),

      evenements:
        await db
          .from('events')
          .select('*',{
            count:'exact',
            head:true
          }),

      idees:
        await db
          .from('ideas')
          .select('*',{
            count:'exact',
            head:true
          }),

      demandesMateriel:
        await db
          .from('material_requests')
          .select('*',{
            count:'exact',
            head:true
          }),

      materiel:
        await db
          .from('materials')
          .select('*',{
            count:'exact',
            head:true
          })

    };


    Object.entries(counts)
      .forEach(
        ([key,result]) => {

          if(result.error){

            addCheck(
              `Comptage ${key}`,
              'error',
              result.error.message
            );

          }else{

            addCheck(
              `Comptage ${key}`,
              'ok',
              `${result.count ?? 0} élément(s)`
            );

          }

        }
      );

  }catch(error){

    addCheck(
      'Comptage des données',
      'error',
      error.message
    );

  }


  /* ----------------------------------------------------------
     1️⃣1️⃣ COHÉRENCE DES DONNÉES
  ---------------------------------------------------------- */

  try{

    const membersResult =
      await db
        .from('members')
        .select('id');

    const childrenResult =
      await db
        .from('member_children')
        .select('id,member_id');


    if(
      !membersResult.error &&
      !childrenResult.error
    ){

      const memberIds =
        new Set(
          (membersResult.data || [])
            .map(m => m.id)
        );


      const orphanChildren =
        (childrenResult.data || [])
          .filter(
            child =>
              child.member_id &&
              !memberIds.has(child.member_id)
          );


      if(orphanChildren.length){

        addCheck(
          'Cohérence des enfants',
          'warning',
          `${orphanChildren.length} enfant(s) avec membre introuvable`
        );

      }else{

        addCheck(
          'Cohérence des enfants',
          'ok',
          'Relations membres correctes'
        );

      }

    }

  }catch(error){

    addCheck(
      'Cohérence des données',
      'warning',
      error.message
    );

  }


  /* ----------------------------------------------------------
     1️⃣2️⃣ RÉSULTAT
  ---------------------------------------------------------- */

  const errors =
    checks.filter(
      c => c.status === 'error'
    ).length;

  const warnings =
    checks.filter(
      c => c.status === 'warning'
    ).length;

  const success =
    checks.filter(
      c => c.status === 'ok'
    ).length;


  let globalStatus;
  let globalColor;
  let globalIcon;
  let globalText;


  if(errors > 0){

    globalStatus = 'error';
    globalColor = '#dc2626';
    globalIcon = '🔴';
    globalText = 'ANOMALIES DÉTECTÉES';

  }else if(warnings > 0){

    globalStatus = 'warning';
    globalColor = '#d97706';
    globalIcon = '🟠';
    globalText = 'SYSTÈME OPÉRATIONNEL AVEC AVERTISSEMENTS';

  }else{

    globalStatus = 'ok';
    globalColor = '#16a34a';
    globalIcon = '🟢';
    globalText = 'SYSTÈME OPÉRATIONNEL';

  }


  /* ----------------------------------------------------------
     AFFICHAGE
  ---------------------------------------------------------- */

  let html = `

    <div style="
      text-align:center;
      margin-bottom:22px;
    ">

      <div style="
        font-size:46px;
        margin-bottom:8px;
      ">
        🧪
      </div>

      <h2 style="margin:0;">
        Diagnostic du système
      </h2>

      <p class="muted" style="margin-top:6px;">
        Vérification complète de l'application
      </p>

    </div>


    <div
      style="
        padding:18px;
        border-radius:14px;
        border:2px solid ${globalColor};
        text-align:center;
        margin-bottom:20px;
      "
    >

      <div style="
        font-size:28px;
        margin-bottom:6px;
      ">
        ${globalIcon}
      </div>

      <strong style="
        color:${globalColor};
        font-size:18px;
      ">
        ${globalText}
      </strong>

      <div
        class="muted"
        style="margin-top:8px;"
      >
        ${success} vérification(s) réussie(s)
        · ${warnings} avertissement(s)
        · ${errors} erreur(s)
      </div>

    </div>


    <div style="
      display:flex;
      flex-direction:column;
      gap:7px;
      max-height:55vh;
      overflow-y:auto;
    ">
  `;


  checks.forEach(check => {

    let icon;
    let color;
    let background;


    if(check.status === 'ok'){

      icon = '🟢';
      color = '#16a34a';
      background = '#f0fdf4';

    }else if(check.status === 'warning'){

      icon = '🟠';
      color = '#d97706';
      background = '#fffbeb';

    }else{

      icon = '🔴';
      color = '#dc2626';
      background = '#fef2f2';

    }


    html += `

      <div
        style="
          padding:11px 13px;
          border-radius:10px;
          background:${background};
          border-left:4px solid ${color};
        "
      >

        <div style="
          display:flex;
          align-items:center;
          gap:8px;
        ">

          <span>
            ${icon}
          </span>

          <strong style="flex:1;">
            ${esc(check.name)}
          </strong>

        </div>

        ${
          check.detail
            ? `
              <div
                class="muted"
                style="
                  margin-top:4px;
                  margin-left:28px;
                  font-size:13px;
                "
              >
                ${esc(check.detail)}
              </div>
            `
            : ''
        }

      </div>

    `;

  });


  html += `

    </div>


    <div
      class="row"
      style="
        margin-top:20px;
        justify-content:flex-end;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="closeModal()"
      >
        Fermer
      </button>

    </div>

  `;


  openModal(html);
/* ============================================================
   📜 HISTORIQUE — DIAGNOSTIC
   ============================================================ */

if(typeof addSystemHistory === 'function'){

  await addSystemHistory(
    'diagnostics',
    'Diagnostic du système',
    'Un diagnostic complet du système a été lancé par l’administrateur.',
    'success'
  );

}

  
}

// ============================================================
// 📜 HISTORIQUE DU SYSTÈME — CATÉGORIES
// ============================================================

function openSystemHistory(){

  const categories = [

    ['👥', 'Membres', 'members'],
    ['🏅', 'Médailles', 'medals'],
    ['👑', 'Bureau / Administrateurs', 'administration'],
    ['🔐', 'Sécurité', 'security'],
    ['🔑', 'Connexions', 'connections'],
    ['🚧', 'Maintenance', 'maintenance'],
    ['🧪', 'Diagnostics', 'diagnostics'],
    ['💾', 'Sauvegardes', 'backups'],
    ['♻️', 'Restaurations', 'restorations'],
    ['📁', 'Documents', 'documents'],
    ['📄', 'Publications', 'publications'],
    ['💬', 'Messagerie', 'messaging'],
    ['🔔', 'Notifications', 'notifications'],
    ['💡', 'Boîte à idées', 'ideas'],
    ['🧰', 'Matériel', 'material'],
    ['📦', 'Demandes de matériel', 'material_requests'],
    ['📅', 'Événements', 'events'],
    ['📊', 'Sondages', 'polls'],
    ['👨‍👩‍👧', 'Enfants', 'children'],
    ['📋', 'Documents de travail', 'work_documents'],
    ['📢', 'Sujets à aborder', 'topics'],
    ['📝', 'Modifications', 'modifications'],
    ['🗑️', 'Suppressions', 'deletions'],
    ['⚙️', 'Configuration', 'configuration'],
    ['🛠️', 'Système', 'system'],
    ['⚠️', 'Erreurs', 'errors'],
    ['🚨', 'Alertes', 'alerts'],
    ['📱', 'Application', 'application'],
    ['🌐', 'Connexion / réseau', 'network']

  ];


  let html = `

    <h2>
      📜 Historique du système
    </h2>

    <p class="muted">
      Sélectionnez une catégorie pour consulter son historique.
    </p>

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(210px,1fr));
        gap:10px;
        margin-top:18px;
      "
    >

  `;


  categories.forEach(category => {

    const icon = category[0];
    const name = category[1];
    const key = category[2];

    html += `

      <button
        type="button"
        class="card"
        onclick="openSystemHistoryCategory('${key}')"
        style="
          border:1px solid var(--border);
          text-align:left;
          cursor:pointer;
          padding:14px;
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px;
          "
        >

          <span style="font-size:22px;">
            ${icon}
          </span>

          <strong>
            ${esc(name)}
          </strong>

        </div>

      </button>

    `;

  });


  html += `

    </div>

    <div
      class="row"
      style="
        margin-top:20px;
        justify-content:flex-end;
      "
    >

      <button
        type="button"
        class="primary"
        onclick="openSystemHistoryAll()"
      >
        📜 Voir tout l'historique
      </button>

      <button
        type="button"
        onclick="closeModal()"
      >
        Fermer
      </button>

    </div>

  `;


  openModal(html);

}
window.openSystemHistory =
  openSystemHistory;

// ============================================================
// 📜 HISTORIQUE — AFFICHAGE D'UNE CATÉGORIE
// ============================================================

async function openSystemHistoryCategory(category){

  try{

    if(
      !member ||
      String(member.role || '').toLowerCase() !== 'admin'
    ){

      alert('Accès réservé à l’administrateur.');

      return;

    }


    const {
      data,
      error
    } = await db

      .from('system_history')

      .select('*')

      .eq('category', category)

      .order(
        'created_at',
        {
          ascending:false
        }
      );


    if(error){

      throw error;

    }


    const categoryNames = {

      members:'👥 Membres',
      medals:'🏅 Médailles',
      administration:'👑 Bureau / Administrateurs',
      security:'🔐 Sécurité',
      connections:'🔑 Connexions',
      maintenance:'🚧 Maintenance',
      diagnostics:'🧪 Diagnostics',
      backups:'💾 Sauvegardes',
      restorations:'♻️ Restaurations',
      documents:'📁 Documents',
      publications:'📄 Publications',

      messaging:'💬 Messagerie',

      notifications:'🔔 Notifications',
      ideas:'💡 Boîte à idées',
      material:'🧰 Matériel',
      material_requests:'📦 Demandes de matériel',
      events:'📅 Événements',
      polls:'📊 Sondages',
      children:'👨‍👩‍👧 Enfants',
      work_documents:'📋 Documents de travail',
      topics:'📢 Sujets à aborder',
      modifications:'📝 Modifications',
      deletions:'🗑️ Suppressions',
      configuration:'⚙️ Configuration',
      system:'🛠️ Système',
      errors:'⚠️ Erreurs',
      alerts:'🚨 Alertes',
      application:'📱 Application',
      network:'🌐 Connexion / réseau'

    };


    const title =
      categoryNames[category] ||
      '📜 Historique';


    let html = `

      <h2>
        ${esc(title)}
      </h2>

      <p class="muted">

        ${data.length}

        événement${data.length > 1 ? 's' : ''}

      </p>

      <div
        style="
          display:flex;
          flex-direction:column;
          gap:10px;
          margin-top:18px;
          max-height:55vh;
          overflow:auto;
        "
      >

    `;


    if(!data.length){

      html += `

        <div class="card">

          <div
            style="
              text-align:center;
              padding:20px;
            "
          >

            📭 Aucun historique dans cette catégorie.

          </div>

        </div>

      `;

    }else{


      data.forEach(item => {


        /* ==================================================
           💬 HISTORIQUE MESSAGERIE
           ================================================== */

        if(category === 'messaging'){


          const metadata =
            item.metadata || {};


          const creator =
            metadata.sender_name ||
            'Inconnu';


          let recipients =
            metadata.recipients || [];


          if(!Array.isArray(recipients)){

            recipients = [recipients];

          }


          const recipientsText =
            recipients.length
              ? recipients.join(', ')
              : 'Aucun destinataire';


          const dateObj =
            item.created_at
              ? new Date(item.created_at)
              : null;


          const date =
            dateObj
              ? dateObj.toLocaleDateString('fr-FR')
              : 'Date inconnue';


          const heure =
            dateObj
              ? dateObj.toLocaleTimeString(
                  'fr-FR',
                  {
                    hour:'2-digit',
                    minute:'2-digit'
                  }
                )
              : '';


          html += `

            <div
              class="card"
              style="
                margin:0;
                padding:14px;
              "
            >

              <div
                style="
                  font-weight:700;
                  font-size:15px;
                "
              >

                💬 Nouvelle conversation

              </div>


              <div
                class="muted"
                style="
                  margin-top:10px;
                  font-size:13px;
                "
              >

                📅 ${esc(date)}

                &nbsp;&nbsp;

                🕐 ${esc(heure)}

              </div>


              <div
                style="
                  margin-top:10px;
                "
              >

                👤
                <strong>
                  Créateur :
                </strong>

                ${esc(creator)}

              </div>


              <div
                style="
                  margin-top:6px;
                "
              >

                👥
                <strong>
                  Destinataire :
                </strong>

                ${esc(recipientsText)}

              </div>

            </div>

          `;


          return;

        }


        /* ==================================================
           📜 AUTRES HISTORIQUES
           ================================================== */


        let icon = 'ℹ️';


        if(item.severity === 'success'){

          icon = '🟢';

        }


        if(item.severity === 'warning'){

          icon = '🟠';

        }


        if(item.severity === 'error'){

          icon = '🔴';

        }


        const dateObj =
          item.created_at
            ? new Date(item.created_at)
            : null;


        const date =
          dateObj
            ? dateObj.toLocaleString('fr-FR')
            : 'Date inconnue';


        html += `

          <div
            class="card"
            style="
              margin:0;
              padding:14px;
            "
          >

            <div
              style="
                display:flex;
                align-items:center;
                gap:8px;
              "
            >

              <span>
                ${icon}
              </span>


              <strong style="flex:1;">

                ${esc(
                  item.action ||
                  'Action'
                )}

              </strong>

            </div>


            <div
              class="muted"
              style="
                margin-top:5px;
                font-size:13px;
              "
            >

              📅 ${esc(date)}

            </div>


            ${
              item.description
                ? `

                  <div
                    style="
                      margin-top:8px;
                    "
                  >

                    ${esc(
                      item.description
                    )}

                  </div>

                `
                : ''
            }

          </div>

        `;


      });


    }


    html += `

      </div>


      <div
        class="row"
        style="
          margin-top:20px;
          justify-content:flex-end;
        "
      >

        <button
          type="button"
          onclick="openSystemHistory()"
        >

          ← Retour aux catégories

        </button>


        <button
          type="button"
          class="primary"
          onclick="closeModal()"
        >

          Fermer

        </button>

      </div>

    `;


    openModal(html);


  }catch(error){

    console.error(
      'ERREUR HISTORIQUE SYSTÈME :',
      error
    );


    alert(
      error.message ||
      'Impossible de charger l’historique.'
    );

  }

}


window.openSystemHistoryCategory =
  openSystemHistoryCategory;

// ============================================================
// 📜 ENREGISTRER UNE ACTION DANS L'HISTORIQUE
// ============================================================

async function addSystemHistory(
  category,
  action,
  description = '',
  severity = 'info',
  metadata = null
){

  try{

    // 🔒 Seul un administrateur peut écrire dans l'historique
    if(
      !member ||
      String(member.role || '').toLowerCase() !== 'admin'
    ){
      return false;
    }


    const { error } = await db
      .from('system_history')
      .insert({

        admin_user_id:
          member.id || null,

        category:
          category || 'system',

        action:
          action || 'Action système',

        description:
          description || null,

        severity:
          severity || 'info',

        metadata:
          metadata || null

      });


    if(error){

      console.error(
        'ERREUR HISTORIQUE SYSTÈME :',
        error
      );

      return false;

    }


    return true;


  }catch(error){

    console.error(
      'ERREUR ENREGISTREMENT HISTORIQUE :',
      error
    );

    return false;

  }

}

// ============================================================
// 🌐 EXPOSITION
// ============================================================

window.addSystemHistory =
  addSystemHistory;


// ============================================================
// 🌐 EXPOSITION
// ============================================================

window.showMyCalendarTour =
  showMyCalendarTour;
// ============================================================
// 🌐 EXPOSITION DES FONCTIONS
// ============================================================

window.manageCalendarTours =
  manageCalendarTours;

window.calendarCityCreate =
  calendarCityCreate;

window.calendarCityEdit =
  calendarCityEdit;

window.calendarCityDelete =
  calendarCityDelete;

window.calendarCityOpen =
  calendarCityOpen;

window.calendarSectorCreate =
  calendarSectorCreate;

window.calendarSectorEdit =
  calendarSectorEdit;

window.calendarSectorDelete =
  calendarSectorDelete;

window.calendarSectorManage =
  calendarSectorManage;

window.calendarAssignmentsSave =
  calendarAssignmentsSave;

window.calendarAssignmentDelete =
  calendarAssignmentDelete;

window.printCalendarTours =
  printCalendarTours;

// =========================================================
// 🌐 EXPOSITION GLOBALE
// =========================================================

window.openMessaging =
  openMessaging;

window.openNewConversation =
  openNewConversation;

window.toggleNewConversationTarget =
  toggleNewConversationTarget;

window.createConversation =
  createConversation;

window.openConversation =
  openConversation;

window.sendConversationMessage =
  sendConversationMessage;

window.markConversationAsRead =
  markConversationAsRead;

window.deleteConversationForMe =
  deleteConversationForMe;

async function refreshData(){

  // ici on recharge uniquement
  // les données nécessaires

}
setInterval(refreshData, 5000);

/* =========================
   FONCTIONS CALENDRIER
   ACCESSIBLES DEPUIS HTML
========================= */
window.changeCode = changeCode;

window.showCalendar = showCalendar;
window.showCalendarAdmin = showCalendarAdmin;
window.renderCalendar = renderCalendar;

window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
window.calendarToday = calendarToday;

window.newCalendarEvent = newCalendarEvent;
window.saveCalendarEvent = saveCalendarEvent;

/* ============================================================
   🔒 PROTECTION INTERFACE UTILISATEUR
   Membres uniquement
   L'administrateur conserve F12 + clic droit
   ============================================================ */

(function(){

  function isAdminUser(){

    try{

      return !!(
        member &&
        String(member.role || '').toLowerCase() === 'admin'
      );

    }catch(error){

      return false;

    }

  }


  function blockUserDevTools(e){

    // 👑 ADMIN : aucune protection
    if(isAdminUser()){
      return;
    }

    const key =
      String(e.key || '').toLowerCase();


    // 🔒 F12
    if(key === 'f12'){

      e.preventDefault();
      e.stopPropagation();

      return false;

    }


    // 🔒 Ctrl + Shift + I
    if(
      e.ctrlKey &&
      e.shiftKey &&
      key === 'i'
    ){

      e.preventDefault();
      e.stopPropagation();

      return false;

    }


    // 🔒 Ctrl + Shift + J
    if(
      e.ctrlKey &&
      e.shiftKey &&
      key === 'j'
    ){

      e.preventDefault();
      e.stopPropagation();

      return false;

    }


    // 🔒 Ctrl + Shift + C
    if(
      e.ctrlKey &&
      e.shiftKey &&
      key === 'c'
    ){

      e.preventDefault();
      e.stopPropagation();

      return false;

    }


    // 🔒 Ctrl + U
    if(
      e.ctrlKey &&
      key === 'u'
    ){

      e.preventDefault();
      e.stopPropagation();

      return false;

    }

  }


  function blockUserContextMenu(e){

    // 👑 ADMIN : clic droit normal
    if(isAdminUser()){
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    return false;

  }


  document.addEventListener(
    'keydown',
    blockUserDevTools,
    true
  );


  document.addEventListener(
    'contextmenu',
    blockUserContextMenu,
    true
  );


})();
