var Service, Characteristic;
var mqtt    = require('mqtt');

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-mqtt-sonoffrf-receiver", "mqtt-sonoffrf-receiver", RfSensorAccessory);
}

function RfSensorAccessory(log, config) {

	this.log = log;

	this.name = config["name"];
	this.url = config['url'];
	this.topic = config['topic'];
	this.sn = config['sn'] || 'Unknown';
	this.rfcode = config['rfcode'] || 'undefined';
	this.rfkey = config['rfkey'] || 'undefined';
	this.ondelay = config['ondelay'] || 10000;
	this.rfcodeon = config['rfcodeon'] || 'undefined';
	this.rfcodeoff = config['rfcodeoff'] || 'undefined';
	this.accessoryservicetype = config['accessoryservicetype'] || 'MotionSensor';
	this.accessoryservicetype = config['accessoryservicetype'] || 'SmokeSensor';

	this.client_Id 		= 'mqttjs_' + Math.random().toString(16).substr(2, 8);

	this.options = {
		keepalive: 10,
		clientId: this.client_Id,
		protocolId: 'MQTT',
		protocolVersion: 4,
		clean: true,
		reconnectPeriod: 1000,
		connectTimeout: 30 * 1000,
		will: {
			topic: 'WillMsg',
			payload: 'Connection Closed abnormally..!',
			qos: 0,
			retain: false
		},
		username: config["username"],
		password: config["password"],
		rejectUnauthorized: false
	};

	switch (this.accessoryservicetype) {
	case 'MotionSensor':
		this.service = new Service.MotionSensor();
		break;
	case 'SmokeSensor':
		this.service = new Service.SmokeSensor();
		break;
	case 'StatelessProgrammableSwitch':
		this.service = new Service.StatelessProgrammableSwitch();
		this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setProps({ maxValue: 0 });
		break;
	}

	this.client  = mqtt.connect(this.url, this.options);

	var self = this;
	var timeout;

	this.client.subscribe(this.topic);
 
	this.client.on('message', function (topic, message) {
		data = JSON.parse(message);
		if (data === null) return null;
		var rfreceiveddata = data.RfReceived.Data;
		var rfreceivedrfkey = data.RfReceived.RfKey;
		if (self.rfcode != 'undefined' || self.rfkey != 'undefined') {
			var sensoractive = Boolean(self.rfcode == rfreceiveddata || self.rfcode == 'any' || self.rfkey == rfreceivedrfkey || self.rfkey == 'any');
			switch (self.accessoryservicetype) {
			case 'MotionSensor':
				if (sensoractive) {
					clearTimeout(timeout);
					self.value = Boolean('true');
					self.service.getCharacteristic(Characteristic.MotionDetected).setValue(self.value);
				}
				self.value = Boolean(0);
				timeout = setTimeout(function() {
				self.service.getCharacteristic(Characteristic.MotionDetected).setValue(self.value);
				}.bind(self), self.ondelay);
				break;
			case 'SmokeSensor':
				if (sensoractive) {
					clearTimeout(timeout);
					self.value = Boolean('true');
					self.service.getCharacteristic(Characteristic.SmokeDetected).setValue(self.value);
				}
				self.value = Boolean(0);
				timeout = setTimeout(function() {
				self.service.getCharacteristic(Characteristic.SmokeDetected).setValue(self.value);
				}.bind(self), self.ondelay);
				break;
			case 'StatelessProgrammableSwitch':
				if (sensoractive) {
					self.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(0);
				}
				break;
			}
		}
		var sensoron = Boolean(self.rfcodeon == rfreceiveddata);
		if (sensoron) {
			self.value = Boolean('true');
			self.service.getCharacteristic(Characteristic.MotionDetected).setValue(self.value);
			self.service.getCharacteristic(Characteristic.SmokeDetected).setValue(self.value);
			
		}
		var sensoroff = Boolean(self.rfcodeoff == rfreceiveddata);
		if (sensoroff) {
			self.value = Boolean(0);
			self.service.getCharacteristic(Characteristic.MotionDetected).setValue(self.value);
			self.service.getCharacteristic(Characteristic.SmokeDetected).setValue(self.value);
		}
	});

}

RfSensorAccessory.prototype.getState = function(callback) {
		this.log(this.name, " - MQTT : ", this.value);
		callback(null, this.value);
}

RfSensorAccessory.prototype.getServices = function() {

	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.Manufacturer, "Sonoff")
		.setCharacteristic(Characteristic.Model, "RF Bridge 433")
		.setCharacteristic(Characteristic.SerialNumber, this.sn);

	return [informationService, this.service];
}
