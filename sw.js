const SW_VERSION = 'TEST-LOGO-AMICALE-2026-09-27';

const ICON_URL = '/assets/notification-icon.png';

self.addEventListener('push', event => {

  let data = {};

  try {
    data = event.data
      ? event.data.json()
      : {};
  } catch (error) {
    data = {
      title: 'Amicale Sapeurs-Pompiers',
      body: event.data
        ? event.data.text()
        : 'Nouvelle notification'
    };
  }

  const title =
    data.title ||
    'Amicale Sapeurs-Pompiers';

  const options = {
    body:
      data.body ||
      'Vous avez une nouvelle notification.',

    icon: ICON_URL,

    badge: ICON_URL,

    image:
      data.image ||
      undefined,

    data: {
      url:
        data.url ||
        '/'
    },

    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

// =====================================================
// 👆 CLIC SUR UNE NOTIFICATION
// =====================================================

self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const url =
      event.notification?.data?.url || '/';

    console.log(
      '🔔 CLIC NOTIFICATION :',
      url
    );

    event.waitUntil(

      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })

      .then(
        windowClients => {

          // Cherche une fenêtre de l'application déjà ouverte
          for(
            const client of windowClients
          ){

            if(
              client.url &&
              'focus' in client
            ){

              return client
                .navigate(url)
                .then(
                  () => client.focus()
                );

            }

          }

          // Sinon ouvre une nouvelle fenêtre
          if(
            'openWindow' in clients
          ){

            return clients.openWindow(
              url
            );

          }

        }
      )

    );

  }
);
