package com._yp.gaitMate.service.commandService;


import com._yp.gaitMate.dto.ApiResponse;
import com._yp.gaitMate.dto.command.CommandRequestDto;
import com._yp.gaitMate.exception.ApiException;
import com._yp.gaitMate.model.Patient;
import com._yp.gaitMate.model.SensorKit;
import com._yp.gaitMate.model.TestSession;
import com._yp.gaitMate.mqtt.core.MqttPublisher;
import com._yp.gaitMate.repository.PatientRepository;
import com._yp.gaitMate.repository.TestSessionRepository;
import com._yp.gaitMate.security.utils.AuthUtil;
import com.amazonaws.services.iot.client.AWSIotException;
import com.amazonaws.services.iot.client.AWSIotQos;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;


@Service
@RequiredArgsConstructor
public class CommandServiceImpl implements CommandService{
    private static final Logger log = LoggerFactory.getLogger(CommandServiceImpl.class);
    private final AuthUtil authUtil;
    private final PatientRepository patientRepository;
    private final MqttPublisher mqttPublisher;
    private final TestSessionRepository testSessionRepository;

    @Override
    public ApiResponse sendCommandToSensor(CommandRequestDto request) {
        // Get the logged-in patient's sensor kit
        Long userId = authUtil.loggedInUserId();

        Patient patient = patientRepository.findByUser_UserId(userId)
                .orElseThrow(() -> new ApiException("Patient not found for user ID: " + userId));

        SensorKit sensorKit = patient.getSensorKit();

        // Validate the sensor-kit
        if (sensorKit == null) {
            throw new ApiException("Patient is not assigned a sensorKit");
        }

        // Ensure no active session exists (To start a test from a sensor-kit, there should not be any active sessions)
        if (testSessionRepository.existsByPatientAndStatus(patient, TestSession.Status.ACTIVE)) {
            throw new ApiException("There is already an active test session for this patient");
        }

        // Build the publishing topic, including the sensorKit id in the middle
        Long sensorId = sensorKit.getId();
        String topic = "device/" + sensorId + "/command";

        // Determine action and publish
        String commandStr = request.getCommand().toLowerCase();

        switch (commandStr) {

            case "check_calibration":
            case "start_calibration":
            case "start_streaming":
            case "capture_orientation":
            case "stop_streaming": {
                String payload = "{ \"command\": \"" + commandStr + "\" }";
                try {
                    mqttPublisher.publishBlocking(topic, payload, AWSIotQos.QOS1);
                    log.info("✅ Command [{}] published to topic [{}]", commandStr, topic);
                    break;
                } catch (AWSIotException e) {
                    log.error("❌ Failed to publish command [{}] to [{}]: {}", commandStr, topic, e.getMessage(), e);
                    throw new ApiException("Failed to send command: " + e.getMessage());
                }
            }

            default:
                throw new ApiException("Invalid command: " + request.getCommand());
        }

        return new ApiResponse("Command " + commandStr + " sent successfully", true);
    }
}