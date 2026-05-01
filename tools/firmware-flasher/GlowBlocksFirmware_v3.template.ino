// ============================================================
//  GlowBlocks Studio — Firmware v3.1
//  ATtiny1616 @ 16MHz internal
//  megaTinyCore by Spence Konde
//
//  AUTO-GENERATED COLOUR LINES — do not edit by hand; use tools/firmware-flasher
//
//  PCB PIN ASSIGNMENTS
//  UPDI     — PA0 (programming pad, not used in firmware)
//  BOOST_EN — PB0 → boost converter enable
//  LED      — PB1 → NeoPixel data
//  LEFT     — PB2 → left Hall sensor
//  RIGHT    — PB3 → right Hall sensor
//
//  PROGRAMMER
//  jtag2updi on Arduino Nano/Uno
//  Pin 6 → 4.7kΩ → UPDI pad
//  5V    → VCC pad
//  GND   → GND pad
//
//  BEHAVIOUR
//  Deep sleep when no magnet detected (~1µA)
//  Either Hall sensor triggered → boost on → LED glows
//  Returns to sleep when both sensors clear
// ============================================================

#include <avr/sleep.h>
#include <avr/interrupt.h>
#include <Adafruit_NeoPixel.h>

#define BOOST_EN      PIN_PB0
#define LED_PIN       PIN_PB1
#define LEFT_SENSOR   PIN_PB2
#define RIGHT_SENSOR  PIN_PB3

// ── COLOUR (injected by firmware-flasher tool) ───────────────
#define COLOUR_R   __COLOUR_R__
#define COLOUR_G   __COLOUR_G__
#define COLOUR_B   __COLOUR_B__
// ─────────────────────────────────────────────────────────────

#define BRIGHTNESS   __BRIGHTNESS__
#define NUM_LEDS     1

// Change this if needed
#define HALL_ACTIVE_STATE LOW

Adafruit_NeoPixel led(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

volatile bool woken = false;

void wakeISR() {
  woken = true;
}

bool magnetDetected() {
  bool leftActive  = digitalRead(LEFT_SENSOR) == HALL_ACTIVE_STATE;
  bool rightActive = digitalRead(RIGHT_SENSOR) == HALL_ACTIVE_STATE;
  return leftActive || rightActive;
}

void boostOn() {
  digitalWrite(BOOST_EN, HIGH);
  delay(50);
}

void boostOff() {
  digitalWrite(BOOST_EN, LOW);
}

void showColor() {
  boostOn();
  led.begin();
  led.setBrightness(BRIGHTNESS);
  led.setPixelColor(0, led.Color(COLOUR_R, COLOUR_G, COLOUR_B));
  led.show();
}

void turnOffLed() {
  led.clear();
  led.show();
  delay(10);
  boostOff();
}

void goToSleep() {
  turnOffLed();

  woken = false;
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();

  noInterrupts();
  interrupts();
  sleep_cpu();

  sleep_disable();
}

void setup() {
  pinMode(BOOST_EN, OUTPUT);
  digitalWrite(BOOST_EN, LOW);

  pinMode(LEFT_SENSOR, INPUT);
  pinMode(RIGHT_SENSOR, INPUT);

  attachInterrupt(digitalPinToInterrupt(LEFT_SENSOR), wakeISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(RIGHT_SENSOR), wakeISR, CHANGE);

  boostOn();
  led.begin();
  led.setBrightness(BRIGHTNESS);
  led.clear();
  led.show();
  boostOff();

  goToSleep();
}

void loop() {
  if (magnetDetected()) {
    showColor();

    while (magnetDetected()) {
      delay(20);
    }

    goToSleep();
  } else {
    goToSleep();
  }
}
