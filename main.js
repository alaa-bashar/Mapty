"use strict";

// --------------------
// DATA CLASSES       |
// --------------------

class Workout {
  id;
  distance;
  duration;
  coords;
  date;
  name;
  marker;

  constructor(distance, duration, coords) {
    this.id = `${Date.now()}`.slice(-10);
    this.distance = distance; // km
    this.duration = duration; // min
    this.coords = coords; // [lat, lng]
    this.date = new Date();
  }
}

class Running extends Workout {
  cadence;
  pace;
  type;

  constructor(distance, duration, coords, cadence) {
    super(distance, duration, coords);
    this.cadence = cadence;
    this.pace = this._calcPace();
    this.type = "running";
    this.name = this._setName();
  }

  _calcPace() {
    return this.duration / this.distance; // min/km
  }

  _setName() {
    // prettier-ignore
    const months = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",];
    return `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Cycling extends Workout {
  ElevationGain;
  speed;
  type;

  constructor(distance, duration, coords, ElevationGain) {
    super(distance, duration, coords);
    this.ElevationGain = ElevationGain;
    this.speed = this._calcSpeed();
    this.type = "cycling";
    this.name = this._setName();
  }

  _calcSpeed() {
    return this.distance / (this.duration / 60); // km/h
  }

  _setName() {
    // prettier-ignore
    const months = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December",];
    return `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

// --------------------------------
// APPLICATION ARCHITECTURE       |
// --------------------------------

// Elements Selection
const form = document.querySelector("form");
const overlay = document.querySelector(".overlay");
const formCloseBtn = document.querySelector(".close-form");
const inputType = document.querySelector(".form-input-type");
const inputDistance = document.querySelector(".form-input-distance");
const inputDuration = document.querySelector(".form-input-duration");
const inputCadence = document.querySelector(".form-input-cadence");
const inputElevation = document.querySelector(".form-input-elevation");
const workoutsList = document.querySelector(".workouts");
const removeAllBtn = document.querySelector(".remove-all");

class App {
  #map;
  #mapEvent;
  #mapIsEnabled;
  #workouts;

  constructor() {
    // Get User's Position
    this._getPosition();

    // Initializing attributes
    this.#workouts = [];
    this.#mapIsEnabled = true;

    // Get Data From Local Storage
    this._getLocalStorage();

    // Attach Events Handlers
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    overlay.addEventListener("click", this._hideForm.bind(this));
    formCloseBtn.addEventListener("click", this._hideForm.bind(this));
    document.addEventListener("keydown", (e) => {
      if (e.key == "Escape") this._hideForm();
    });
    workoutsList.addEventListener("click", this._moveToPopup.bind(this));
    removeAllBtn.addEventListener("click", this._deleteAllWorkouts.bind(this));
    window.addEventListener("load", this._toggleRemoveAllBtn().bind(this));
  }

  _getPosition() {
    // GEO location API to get the user's current position
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        // Incase of success
        this._loadMap.bind(this),
        // Incase of failure
        () => alert("Couldn't get your position!")
      );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    this.#map = L.map("map").setView([latitude, longitude], 13);
    L.tileLayer("https://tile.osm.ch/switzerland/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.bzh/br/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Adding On Click Event To The Map
    this.#map.on("click", (mapEvent) => {
      if (this.#mapIsEnabled) this._showForm(mapEvent);
    });

    // Handling Markers
    if (!this.#workouts) return;
    this.#workouts.forEach((workout) => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapEvent) {
    this.#mapEvent = mapEvent;
    form.classList.remove("hidden");
    overlay.classList.remove("hidden");
    this.#mapIsEnabled = false;
  }

  _hideForm() {
    form.classList.add("hidden");
    overlay.classList.add("hidden");
    setTimeout(() => {
      this.#mapIsEnabled = true;
    }, 500);
  }

  _toggleElevationField() {
    inputElevation.closest(".form-elem").classList.toggle("hidden");
    inputCadence.closest(".form-elem").classList.toggle("hidden");
  }

  _newWorkout(e) {
    e.preventDefault();

    // Get Data From The Form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;

    // Create Workout Based On It's Type [Running, Cycling]
    let newWorkout;
    if (type == "running") {
      const cadence = inputCadence.value;
      newWorkout = new Running(distance, duration, [lat, lng], cadence);
    } else if (type == "cycling") {
      const elevation = inputElevation.value;
      newWorkout = new Cycling(distance, duration, [lat, lng], elevation);
    }

    // Add the new object to the workout array
    this.#workouts.push(newWorkout);

    // Render workout and marker
    this._renderWorkoutMarker(newWorkout);
    this._renderWorkout(newWorkout);

    // Hide the form + clear input field
    this._hideForm();
    inputElevation.value =
      inputCadence.value =
      inputDuration.value =
      inputDistance.value =
        "";

    this._setLocalStorage();
    this._toggleRemoveAllBtn();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .openPopup()
      .setPopupContent(
        `${workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${workout.name}`
      );
    workout.marker = marker;
  }

  _renderWorkout(workout) {
    const html = `
      <li class="workout workout-${workout.type}" data-id="${workout.id}">
        <i class="fa-solid fa-xmark close-icon delete-workout"></i>
        <h2 class="workout-title">${workout.name}</h2>
        <div class="workout-details">
          <span class="workout-icon">${
            workout.type === "running" ? "🏃‍♂️" : "🚴‍♀️"
          }</span>
          <span class="workout-value">${workout.distance}</span>
          <span class="workout-unit">km</span>
        </div>
        <div class="workout-details">
          <span class="workout-icon">⏱</span>
          <span class="workout-value">${workout.duration}</span>
          <span class="workout-unit">min</span>
        </div>
        <div class="workout-details">
          <span class="workout-icon">⚡️</span>
          <span class="workout-value">${
            workout.type == "running"
              ? workout.pace.toFixed(1)
              : workout.speed.toFixed(1)
          }</span>
          <span class="workout-unit">${
            workout.type == "running" ? "min/km" : "km/h"
          }</span>
        </div>
        <div class="workout-details">
          <span class="workout-icon">${
            workout.type == "running" ? "🦶🏼" : "⛰"
          }</span>
          <span class="workout-value">${
            workout.type == "running" ? workout.cadence : workout.ElevationGain
          }</span>
          <span class="workout-unit">${
            workout.type == "running" ? "spm" : "m"
          }</span>
        </div>
      </li>
    `;

    workoutsList.insertAdjacentHTML("afterbegin", html);
    const deleteWorkoutBtn = document.querySelector(".delete-workout");
    deleteWorkoutBtn.addEventListener("click", (e) => {
      this._deleteWorkout(e);
    });
  }

  _moveToPopup(e) {
    const workoutElem = e.target.closest(".workout");
    if (!workoutElem) return;
    const workout = this.#workouts.find(
      (work) => work.id === workoutElem.dataset.id
    );
    this.#map.setView(workout.coords, 13, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem("workouts", stringify(this.#workouts));

    // This function is for handling "Converting circular structure to JSON" Error
    function stringify(obj) {
      let cache = [];
      let str = JSON.stringify(obj, function (key, value) {
        if (typeof value === "object" && value !== null) {
          if (cache.indexOf(value) !== -1) {
            // Circular reference found, discard key
            return;
          }
          // Store value in our collection
          cache.push(value);
        }
        return value;
      });
      cache = null; // reset the cache
      return str;
    }
  }

  _getLocalStorage() {
    let data;
    if (localStorage.getItem("workouts") != undefined)
      data = JSON.parse(localStorage.getItem("workouts"));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach((workout) => {
      this._renderWorkout(workout);
    });
  }

  _deleteWorkout(e) {
    // Select the workout to delete
    const workoutElem = e.target.closest(".workout");

    // Remove marker
    const workout = this.#workouts.find(
      (workout) => workout.id === workoutElem.dataset.id
    );
    this.#map.removeLayer(workout.marker);

    // Remove from workouts array
    this.#workouts = this.#workouts.filter(
      (workout) => workout.id !== workoutElem.dataset.id
    );

    // Update the local storage
    this._setLocalStorage();

    // Remove from the dom
    e.target.closest(".workout").remove();

    this._toggleRemoveAllBtn();
  }

  _deleteAllWorkouts() {
    // Remove marker
    for (let i = 0; i < this.#workouts.length; i++)
      this.#map.removeLayer(this.#workouts[i].marker);

    // Clear workouts array
    this.#workouts = [];

    // Update the local storage
    this._setLocalStorage();

    // Clear the DOM
    workoutsList.innerHTML = "";

    this._toggleRemoveAllBtn();
  }

  _toggleRemoveAllBtn() {
    if (this.#workouts.length != 0) {
      removeAllBtn.classList.remove("hidden");
      return;
    } else {
      removeAllBtn.classList.add("hidden");
    }
  }
}

// Run App
const app = new App();
