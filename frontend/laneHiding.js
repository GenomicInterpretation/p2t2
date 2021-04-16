// The lane hiding constality is implemented using cookies.
// Basically, when the user hides a lane, a cookie is set, and screen is redrawn
// This way the tool remembers what lanes should/should not be visible, hopefully providing better user experience
// Each lane is identified using its Name - short identifier

export const hiddenLaneCookie = "p2t2.hiddenLane";

export const getHiddenLaneCookieArray = () => {
  return getCookie(hiddenLaneCookie).split(":");
}

export const setHiddenLaneCookieArray = hidden => {
  let hiddenText = hidden.join(":");
  setCookie(hiddenLaneCookie, hiddenText, 1);
};
export const hideLane = name => {
  let hidden = getHiddenLaneCookieArray();
  if(!hidden.includes(name)) {
    hidden.push(name);
    setHiddenLaneCookieArray(hidden);
  }
}

export const showLane = name => {
  setHiddenLaneCookieArray(
    getHiddenLaneCookieArray().filter(i => i !== name)
  );
}

export const isLaneHidden = name => {
  let hidden = getHiddenLaneCookieArray();
  return hidden.includes(name);
}

// Stolen from the internet
export const setCookie = (cname, cvalue, exdays) => {
  let d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

// Stolen from the internet
export const getCookie = cname => {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}