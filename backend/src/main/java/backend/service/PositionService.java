package backend.service;

import backend.dto.PositionRequest;
import backend.dto.PositionResponse;
import backend.entity.Position;
import backend.repository.PositionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class PositionService {

    private final PositionRepository positionRepository;

    public PositionService(PositionRepository positionRepository) {
        this.positionRepository = positionRepository;
    }

    @Transactional(readOnly = true)
    public List<PositionResponse> getAllPositions() {
        return positionRepository.findAll().stream().map(PositionResponse::new).toList();
    }

    public PositionResponse createPosition(PositionRequest request) {
        if (positionRepository.existsByNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("A position named \"" + request.getName() + "\" already exists");
        }
        Position position = new Position();
        position.setName(request.getName().trim());
        position.setDescription(request.getDescription());
        return new PositionResponse(positionRepository.save(position));
    }
}
